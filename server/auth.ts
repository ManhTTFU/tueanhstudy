/**
 * Xác thực phụ huynh.
 *  - PIN được băm bằng scrypt + salt ngẫu nhiên, KHÔNG lưu văn bản thuần.
 *  - Đăng nhập thành công => cookie HttpOnly chứa token ký HMAC (hết hạn 30 phút).
 *  - Sai PIN 5 lần => khoá 5 phút (lưu trong database, bền vững giữa các instance).
 *  - Mọi API nhạy cảm (xoá, nhập, xuất dữ liệu, lịch sử) kiểm tra token tại backend.
 */
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { appSettings, type AppSettingsRow } from '../db/schema.js';
import type { Database } from './db.js';
import { ApiError, conflict, unauthorized } from './errors.js';
import { bumpSessionVersion, getSettingsRow } from './services/settingsService.js';

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

export async function getSecret(db: Database, row: AppSettingsRow): Promise<string> {
  const fromEnv = process.env.PARENT_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (row.sessionSecret) return row.sessionSecret;
  const secret = randomBytes(32).toString('base64url');
  await db.update(appSettings).set({ sessionSecret: secret }).where(eq(appSettings.id, 1));
  return secret;
}

export function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function issueToken(db: Database, now = Date.now()): Promise<string> {
  const row = await getSettingsRow(db);
  const secret = await getSecret(db, row);
  const payload = Buffer.from(JSON.stringify({ v: row.sessionVersion, exp: now + SESSION_TTL_MS })).toString(
    'base64url',
  );
  return `${payload}.${sign(payload, secret)}`;
}

export async function isTokenValid(db: Database, token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const row = await getSettingsRow(db);
  if (!row.pinHash) return false;
  const secret = await getSecret(db, row);
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { v?: number; exp?: number };
    return data.v === row.sessionVersion && typeof data.exp === 'number' && data.exp > now;
  } catch {
    return false;
  }
}

export async function requireParent(db: Database, token: string | undefined): Promise<void> {
  if (!(await isTokenValid(db, token))) throw unauthorized();
}

export async function setupPin(db: Database, pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await db.transaction(async (tx) => {
    const row = await getSettingsRow(tx, true);
    if (row.pinHash) throw conflict('Mã PIN đã được thiết lập');
    await tx.update(appSettings).set({ pinHash: hash, updatedAt: new Date() }).where(eq(appSettings.id, 1));
  });
}

/** Kiểm tra PIN có khoá chống dò mã. Ném lỗi nếu sai hoặc đang bị khoá. */
export async function checkPinWithLockout(db: Database, pin: string, now = new Date()): Promise<void> {
  const row = await getSettingsRow(db);
  if (!row.pinHash) throw conflict('Chưa thiết lập mã PIN');
  if (row.pinLockedUntil && row.pinLockedUntil > now) {
    const minutes = Math.ceil((row.pinLockedUntil.getTime() - now.getTime()) / 60_000);
    throw new ApiError(423, 'locked', `Nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`);
  }
  const ok = await verifyPin(pin, row.pinHash);
  if (ok) {
    if (row.failedPinAttempts > 0 || row.pinLockedUntil) {
      await db.update(appSettings).set({ failedPinAttempts: 0, pinLockedUntil: null }).where(eq(appSettings.id, 1));
    }
    return;
  }
  const attempts = row.failedPinAttempts + 1;
  const lock = attempts >= MAX_PIN_ATTEMPTS;
  await db
    .update(appSettings)
    .set({
      failedPinAttempts: lock ? 0 : attempts,
      pinLockedUntil: lock ? new Date(now.getTime() + PIN_LOCK_MS) : null,
    })
    .where(eq(appSettings.id, 1));
  throw new ApiError(
    401,
    'wrong_pin',
    lock
      ? 'Nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.'
      : `Mã PIN chưa đúng (còn ${MAX_PIN_ATTEMPTS - attempts} lần thử).`,
  );
}

export async function changePin(db: Database, currentPin: string, newPin: string): Promise<void> {
  await checkPinWithLockout(db, currentPin);
  const hash = await hashPin(newPin);
  await db.update(appSettings).set({ pinHash: hash, updatedAt: new Date() }).where(eq(appSettings.id, 1));
  await bumpSessionVersion(db); // đăng xuất mọi phiên cũ
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
