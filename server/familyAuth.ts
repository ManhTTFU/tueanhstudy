/**
 * Gia đình – mỗi gia đình là một tài khoản riêng, dữ liệu học tập tách biệt.
 *  - Đăng nhập trên máy mới bằng TÊN GIA ĐÌNH + MÃ GIA ĐÌNH (hoặc + PIN phụ huynh
 *    khi quên mã). Máy được nhớ 1 năm (cookie `bvht_family`, HttpOnly, ký HMAC).
 *  - Tạo gia đình mới cần MÃ MỜI (biến môi trường FAMILY_INVITE_CODE), tối đa
 *    MAX_FAMILIES gia đình (mặc định 10). Gia đình đầu tiên của hệ thống tạo tự do.
 *  - Mã gia đình băm scrypt; sai 5 lần => khoá 5 phút (lưu trong database).
 *  - Đổi mã / "đăng xuất mọi máy" => tăng family_version, cookie cũ hết hiệu lực.
 */
import { timingSafeEqual } from 'node:crypto';
import { count, eq, sql } from 'drizzle-orm';
import { families, progress } from '../db/schema.js';
import { checkPinWithLockout, hashPin, MAX_PIN_ATTEMPTS, PIN_LOCK_MS, readToken, signToken, verifyPin } from './auth.js';
import type { Database } from './db.js';
import { ApiError, conflict } from './errors.js';
import { getFamilyRow } from './services/settingsService.js';

export const FAMILY_COOKIE = 'bvht_family';
export const FAMILY_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_FAMILIES = 10;

export function maxFamilies(): number {
  const n = Number(process.env.MAX_FAMILIES);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_FAMILIES;
}

/** "Nhà Tuệ Anh " => "nha tue anh" – so khớp tên không phân biệt dấu, hoa/thường, khoảng trắng. */
export function normalizeFamilyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim();

// ---------- Đăng ký ----------

export interface RegistrationInfo {
  /** Có tạo thêm gia đình được không. */
  open: boolean;
  /** Cần mã mời (đã có ít nhất 1 gia đình). */
  inviteRequired: boolean;
  /** Đã đủ số gia đình tối đa. */
  full: boolean;
}

export async function getRegistrationInfo(db: Database): Promise<RegistrationInfo> {
  const [row] = await db.select({ n: count() }).from(families);
  const n = row?.n ?? 0;
  const full = n >= maxFamilies();
  const inviteRequired = n > 0;
  const inviteConfigured = Boolean(process.env.FAMILY_INVITE_CODE);
  return { open: !full && (!inviteRequired || inviteConfigured), inviteRequired, full };
}

function inviteMatches(invite: string | undefined): boolean {
  const expected = process.env.FAMILY_INVITE_CODE;
  if (!expected || !invite) return false;
  const a = Buffer.from(invite.trim());
  const b = Buffer.from(expected.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function registerFamily(
  db: Database,
  input: { name: string; code: string; pin?: string | undefined; invite?: string | undefined },
): Promise<string> {
  const name = cleanName(input.name);
  const nameKey = normalizeFamilyName(name);
  const codeHash = await hashPin(input.code);
  const pinHash = input.pin ? await hashPin(input.pin) : null;
  return db.transaction(async (tx) => {
    // Khoá bảng để đếm chính xác khi nhiều người đăng ký cùng lúc.
    await tx.execute(sql`lock table ${families} in share row exclusive mode`);
    const info = await getRegistrationInfo(tx);
    if (info.full) throw conflict(`Hệ thống đã đủ ${maxFamilies()} gia đình`);
    if (info.inviteRequired) {
      if (!process.env.FAMILY_INVITE_CODE) throw new ApiError(403, 'registration_closed', 'Chưa mở đăng ký gia đình mới');
      if (!inviteMatches(input.invite)) throw new ApiError(403, 'wrong_invite', 'Mã mời chưa đúng');
    }
    const [existing] = await tx.select({ id: families.id }).from(families).where(eq(families.nameKey, nameKey));
    if (existing) throw conflict('Tên gia đình này đã có, hãy chọn tên khác');
    const [row] = await tx.insert(families).values({ name, nameKey, codeHash, pinHash }).returning({ id: families.id });
    await tx.insert(progress).values({ familyId: row!.id });
    return row!.id;
  });
}

// ---------- Đăng nhập ----------

const wrongLogin = () => new ApiError(401, 'wrong_family_login', 'Tên gia đình hoặc mã chưa đúng');

/**
 * Đăng nhập gia đình trên máy mới bằng mã gia đình, hoặc PIN phụ huynh (khi quên mã).
 * Trả về id gia đình. Có khoá chống dò mã theo từng gia đình.
 */
export async function loginFamily(
  db: Database,
  input: { name: string; code?: string | undefined; pin?: string | undefined },
  now = new Date(),
): Promise<string> {
  const [family] = await db.select().from(families).where(eq(families.nameKey, normalizeFamilyName(input.name)));
  if (!family) throw wrongLogin();

  if (input.pin !== undefined) {
    if (!family.pinHash) throw wrongLogin();
    await checkPinWithLockout(db, family.id, input.pin, now);
    return family.id;
  }

  // Gia đình cũ chưa đặt mã lẫn PIN: chỉ cần tên (phụ huynh nên đặt mã ngay).
  if (!family.codeHash) {
    if (family.pinHash) throw new ApiError(401, 'use_pin', 'Gia đình này chưa có mã gia đình, hãy đăng nhập bằng PIN phụ huynh');
    return family.id;
  }
  if (family.codeLockedUntil && family.codeLockedUntil > now) {
    const minutes = Math.ceil((family.codeLockedUntil.getTime() - now.getTime()) / 60_000);
    throw new ApiError(423, 'locked', `Nhập sai quá nhiều lần. Thử lại sau ${minutes} phút nhé.`);
  }
  if (input.code !== undefined && (await verifyPin(input.code, family.codeHash))) {
    if (family.failedCodeAttempts > 0 || family.codeLockedUntil) {
      await db.update(families).set({ failedCodeAttempts: 0, codeLockedUntil: null }).where(eq(families.id, family.id));
    }
    return family.id;
  }
  const attempts = family.failedCodeAttempts + 1;
  const lock = attempts >= MAX_PIN_ATTEMPTS;
  await db
    .update(families)
    .set({ failedCodeAttempts: lock ? 0 : attempts, codeLockedUntil: lock ? new Date(now.getTime() + PIN_LOCK_MS) : null })
    .where(eq(families.id, family.id));
  if (lock) throw new ApiError(423, 'locked', 'Nhập sai quá nhiều lần. Thử lại sau 5 phút nhé.');
  throw wrongLogin();
}

// ---------- Cookie gia đình ----------

export async function issueFamilyToken(db: Database, familyId: string, now = Date.now()): Promise<string> {
  const row = await getFamilyRow(db, familyId);
  return signToken(db, 'family', { fid: familyId, f: row.familyVersion, exp: now + FAMILY_TTL_MS });
}

/** Gia đình đang đăng nhập trên máy này (null nếu chưa / token hết hiệu lực). */
export async function familyFromToken(db: Database, token: string | undefined, now = Date.now()): Promise<string | null> {
  const data = await readToken<{ fid?: string; f?: number; exp?: number }>(db, 'family', token, now);
  if (!data?.fid) return null;
  const [row] = await db
    .select({ familyVersion: families.familyVersion })
    .from(families)
    .where(eq(families.id, data.fid));
  return row && row.familyVersion === data.f ? data.fid : null;
}

export function familyRequired(): ApiError {
  return new ApiError(401, 'family_required', 'Cần đăng nhập gia đình');
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

// ---------- Quản lý (phụ huynh) ----------

/** Đổi mã gia đình: mọi máy khác phải đăng nhập lại. */
export async function setFamilyCode(db: Database, familyId: string, code: string): Promise<void> {
  const codeHash = await hashPin(code);
  await db
    .update(families)
    .set({
      codeHash,
      familyVersion: sql`${families.familyVersion} + 1`,
      failedCodeAttempts: 0,
      codeLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(families.id, familyId));
}

export async function bumpFamilyVersion(db: Database, familyId: string): Promise<void> {
  await db
    .update(families)
    .set({ familyVersion: sql`${families.familyVersion} + 1`, updatedAt: new Date() })
    .where(eq(families.id, familyId));
}

export async function renameFamily(db: Database, familyId: string, rawName: string): Promise<string> {
  const name = cleanName(rawName);
  const nameKey = normalizeFamilyName(name);
  const [existing] = await db.select({ id: families.id }).from(families).where(eq(families.nameKey, nameKey));
  if (existing && existing.id !== familyId) throw conflict('Tên gia đình này đã có, hãy chọn tên khác');
  await db.update(families).set({ name, nameKey, updatedAt: new Date() }).where(eq(families.id, familyId));
  return name;
}
