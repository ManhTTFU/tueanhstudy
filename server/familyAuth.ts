/**
 * Mã gia đình – khoá cả ứng dụng với người ngoài (bé không cần đăng nhập).
 *  - Chưa đặt mã (family_code_hash = NULL) => ứng dụng mở như trước.
 *  - Đã đặt mã => mọi API (trừ vài API mở khoá/phụ huynh) cần cookie `bvht_family`.
 *    Máy nhập đúng mã được nhớ 1 năm (cookie HttpOnly, token ký HMAC).
 *  - Mã được băm bằng scrypt; sai 5 lần => khoá 5 phút (lưu trong database).
 *  - Đổi mã / "đăng xuất mọi máy" => tăng family_version, cookie cũ hết hiệu lực.
 *  - Phụ huynh đăng nhập bằng PIN cũng nhận cookie gia đình (để khôi phục khi quên mã).
 */
import { timingSafeEqual } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { appSettings, type AppSettingsRow } from '../db/schema.js';
import { getSecret, hashPin, MAX_PIN_ATTEMPTS, PIN_LOCK_MS, sign, verifyPin } from './auth.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { getSettingsRow } from './services/settingsService.js';

export const FAMILY_COOKIE = 'bvht_family';
export const FAMILY_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** Tách miền chữ ký: token gia đình không thể dùng làm token phụ huynh và ngược lại. */
const familySign = (payload: string, secret: string) => sign(`family:${payload}`, secret);

export function isFamilyCodeEnabled(row: AppSettingsRow): boolean {
  return row.familyCodeHash !== null;
}

export async function issueFamilyToken(db: Database, now = Date.now()): Promise<string> {
  const row = await getSettingsRow(db);
  const secret = await getSecret(db, row);
  const payload = Buffer.from(JSON.stringify({ f: row.familyVersion, exp: now + FAMILY_TTL_MS })).toString('base64url');
  return `${payload}.${familySign(payload, secret)}`;
}

/** Máy này có được vào ứng dụng không (luôn đúng khi chưa bật mã gia đình). */
export async function hasFamilyAccess(db: Database, token: string | undefined, now = Date.now()): Promise<boolean> {
  const row = await getSettingsRow(db);
  if (!isFamilyCodeEnabled(row)) return true;
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const secret = await getSecret(db, row);
  const expected = Buffer.from(familySign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { f?: number; exp?: number };
    return data.f === row.familyVersion && typeof data.exp === 'number' && data.exp > now;
  } catch {
    return false;
  }
}

export function familyRequired(): ApiError {
  return new ApiError(401, 'family_required', 'Cần nhập mã gia đình');
}

/** Kiểm tra mã gia đình, có khoá chống dò mã. Ném lỗi nếu sai hoặc đang bị khoá. */
export async function checkFamilyCode(db: Database, code: string, now = new Date()): Promise<void> {
  const row = await getSettingsRow(db);
  if (!row.familyCodeHash) return;
  if (row.familyLockedUntil && row.familyLockedUntil > now) {
    const minutes = Math.ceil((row.familyLockedUntil.getTime() - now.getTime()) / 60_000);
    throw new ApiError(423, 'locked', `Nhập sai quá nhiều lần. Thử lại sau ${minutes} phút nhé.`);
  }
  if (await verifyPin(code, row.familyCodeHash)) {
    if (row.failedFamilyAttempts > 0 || row.familyLockedUntil) {
      await db.update(appSettings).set({ failedFamilyAttempts: 0, familyLockedUntil: null }).where(eq(appSettings.id, 1));
    }
    return;
  }
  const attempts = row.failedFamilyAttempts + 1;
  const lock = attempts >= MAX_PIN_ATTEMPTS;
  await db
    .update(appSettings)
    .set({
      failedFamilyAttempts: lock ? 0 : attempts,
      familyLockedUntil: lock ? new Date(now.getTime() + PIN_LOCK_MS) : null,
    })
    .where(eq(appSettings.id, 1));
  throw new ApiError(
    401,
    'wrong_family_code',
    lock ? 'Nhập sai quá nhiều lần. Thử lại sau 5 phút nhé.' : `Mã gia đình chưa đúng (còn ${MAX_PIN_ATTEMPTS - attempts} lần thử).`,
  );
}

/** Đặt / đổi (code là chuỗi số) hoặc tắt (code = null) mã gia đình. Mọi máy cũ phải nhập lại. */
export async function setFamilyCode(db: Database, code: string | null): Promise<void> {
  const hash = code === null ? null : await hashPin(code);
  await getSettingsRow(db);
  await db
    .update(appSettings)
    .set({
      familyCodeHash: hash,
      familyVersion: sql`${appSettings.familyVersion} + 1`,
      failedFamilyAttempts: 0,
      familyLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(appSettings.id, 1));
}

export async function bumpFamilyVersion(db: Database): Promise<void> {
  await db
    .update(appSettings)
    .set({ familyVersion: sql`${appSettings.familyVersion} + 1`, updatedAt: new Date() })
    .where(eq(appSettings.id, 1));
}

export function buildFamilyCookie(token: string | null, secure: boolean): string {
  const parts = [
    `${FAMILY_COOKIE}=${token ?? ''}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${token ? Math.floor(FAMILY_TTL_MS / 1000) : 0}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
