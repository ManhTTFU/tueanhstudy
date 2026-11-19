/**
 * Tiện ích xác thực dùng chung + xác thực phụ huynh (theo từng gia đình).
 *  - PIN / mã gia đình được băm bằng scrypt + salt ngẫu nhiên, KHÔNG lưu văn bản thuần.
 *  - Token ký HMAC bằng một khoá bí mật chung; mỗi loại token có "miền" riêng
 *    (phụ huynh / gia đình) nên không thể dùng lẫn cho nhau.
 *  - Đăng nhập phụ huynh thành công => cookie HttpOnly (hết hạn 30 phút), gắn với
 *    đúng gia đình đang đăng nhập trên máy.
 *  - Sai PIN 5 lần => khoá 5 phút (lưu trong database).
 */
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { appSettings, families } from '../db/schema.js';
import type { Database } from './db.js';
import { ApiError, conflict, unauthorized } from './errors.js';
import { bumpSessionVersion, getFamilyRow, getGlobalSettingsRow } from './services/settingsService.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

export const PARENT_COOKIE = 'bvht_parent';
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32, SCRYPT_OPTS);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scrypt(pin, Buffer.from(saltB64, 'base64url'), expected.length, SCRYPT_OPTS);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Khoá bí mật chung: ưu tiên biến môi trường, nếu không có thì tự sinh và lưu DB. */
export async function getSecret(db: Database): Promise<string> {
  const fromEnv = process.env.PARENT_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const row = await getGlobalSettingsRow(db);
  if (row.sessionSecret) return row.sessionSecret;
  const secret = randomBytes(32).toString('base64url');
  await db.update(appSettings).set({ sessionSecret: secret }).where(eq(appSettings.id, 1));
  return secret;
}

/** Ký token: `domain` tách riêng từng loại token. */
export async function signToken(db: Database, domain: string, data: Record<string, unknown>): Promise<string> {
  const secret = await getSecret(db);
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${hmac(`${domain}:${payload}`, secret)}`;
}

/** Kiểm tra chữ ký + hạn dùng; trả dữ liệu trong token hoặc null. */
export async function readToken<T extends { exp?: number }>(
  db: Database,
  domain: string,
  token: string | undefined,
  now = Date.now(),
): Promise<T | null> {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const secret = await getSecret(db);
  const expected = Buffer.from(hmac(`${domain}:${payload}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as T;
    return typeof data.exp === 'number' && data.exp > now ? data : null;
  } catch {
    return null;
  }
}

function hmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

// ---------- Phụ huynh ----------

export async function issueToken(db: Database, familyId: string, now = Date.now()): Promise<string> {
  const row = await getFamilyRow(db, familyId);
  return signToken(db, 'parent', { fid: familyId, v: row.sessionVersion, exp: now + SESSION_TTL_MS });
}

/** Token phụ huynh hợp lệ VÀ thuộc đúng gia đình đang đăng nhập trên máy. */
export async function isTokenValid(db: Database, familyId: string, token: string | undefined, now = Date.now()): Promise<boolean> {
  const data = await readToken<{ fid?: string; v?: number; exp?: number }>(db, 'parent', token, now);
  if (!data || data.fid !== familyId) return false;
  const row = await getFamilyRow(db, familyId);
  return row.pinHash !== null && data.v === row.sessionVersion;
}

export async function requireParent(db: Database, familyId: string, token: string | undefined): Promise<void> {
  if (!(await isTokenValid(db, familyId, token))) throw unauthorized();
}

export async function setupPin(db: Database, familyId: string, pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await db.transaction(async (tx) => {
    const row = await getFamilyRow(tx, familyId, true);
    if (row.pinHash) throw conflict('Mã PIN đã được thiết lập');
    await tx.update(families).set({ pinHash: hash, updatedAt: new Date() }).where(eq(families.id, familyId));
  });
}

/** Kiểm tra PIN có khoá chống dò mã. Ném lỗi nếu sai hoặc đang bị khoá. */
export async function checkPinWithLockout(db: Database, familyId: string, pin: string, now = new Date()): Promise<void> {
  const row = await getFamilyRow(db, familyId);
  if (!row.pinHash) throw conflict('Chưa thiết lập mã PIN');
  if (row.pinLockedUntil && row.pinLockedUntil > now) {
    const minutes = Math.ceil((row.pinLockedUntil.getTime() - now.getTime()) / 60_000);
    throw new ApiError(423, 'locked', `Nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`);
  }
  if (await verifyPin(pin, row.pinHash)) {
    if (row.failedPinAttempts > 0 || row.pinLockedUntil) {
      await db.update(families).set({ failedPinAttempts: 0, pinLockedUntil: null }).where(eq(families.id, familyId));
    }
    return;
  }
  const attempts = row.failedPinAttempts + 1;
  const lock = attempts >= MAX_PIN_ATTEMPTS;
  await db
    .update(families)
    .set({
      failedPinAttempts: lock ? 0 : attempts,
      pinLockedUntil: lock ? new Date(now.getTime() + PIN_LOCK_MS) : null,
    })
    .where(eq(families.id, familyId));
  throw new ApiError(
    401,
    'wrong_pin',
    lock
      ? 'Nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.'
      : `Mã PIN chưa đúng (còn ${MAX_PIN_ATTEMPTS - attempts} lần thử).`,
  );
}

export async function changePin(db: Database, familyId: string, currentPin: string, newPin: string): Promise<void> {
  await checkPinWithLockout(db, familyId, currentPin);
  const hash = await hashPin(newPin);
  await db.update(families).set({ pinHash: hash, updatedAt: new Date() }).where(eq(families.id, familyId));
  await bumpSessionVersion(db, familyId); // đăng xuất mọi phiên cũ
}

export function buildCookie(token: string | null, secure: boolean): string {
  const parts = [
    `${PARENT_COOKIE}=${token ?? ''}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${token ? Math.floor(SESSION_TTL_MS / 1000) : 0}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        // bỏ qua cookie hỏng
      }
    }
  }
  return out;
}
