import { eq, sql } from 'drizzle-orm';
import { appSettings, families, type AppSettingsRow, type FamilyRow } from '../../db/schema.js';
import { AGE_GROUPS, type AgeGroup } from '../../src/engine/types.js';
import type { Database } from '../db.js';
import { notFound } from '../errors.js';

export interface PublicSettings {
  soundEnabled: boolean;
  reducedMotion: boolean;
  /** Nhóm tuổi đang chọn ở trang chủ. */
  ageGroup: AgeGroup;
  pinConfigured: boolean;
  familyName: string;
}

/** Cấu hình chung của hệ thống (id = 1) – chỉ chứa khoá bí mật ký cookie. */
export async function getGlobalSettingsRow(db: Database): Promise<AppSettingsRow> {
  await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (!row) throw new Error('Không đọc được cài đặt');
  return row;
}

/** Dòng của một gia đình (cài đặt + bảo mật). */
export async function getFamilyRow(db: Database, familyId: string, forUpdate = false): Promise<FamilyRow> {
  const query = db.select().from(families).where(eq(families.id, familyId));
  const rows = forUpdate ? await query.for('update') : await query;
  const row = rows[0];
  if (!row) throw notFound('Không tìm thấy gia đình');
  return row;
}

export function toPublicSettings(row: FamilyRow): PublicSettings {
  return {
    soundEnabled: row.soundEnabled,
    reducedMotion: row.reducedMotion,
    ageGroup: (AGE_GROUPS as readonly string[]).includes(row.ageGroup) ? (row.ageGroup as AgeGroup) : 'preschool',
    pinConfigured: row.pinHash !== null,
    familyName: row.name,
  };
}

export async function getPublicSettings(db: Database, familyId: string): Promise<PublicSettings> {
  return toPublicSettings(await getFamilyRow(db, familyId));
}

export async function updateSettings(
  db: Database,
  familyId: string,
  patch: { soundEnabled?: boolean | undefined; reducedMotion?: boolean | undefined; ageGroup?: AgeGroup | undefined },
): Promise<PublicSettings> {
  const values: Partial<FamilyRow> = { updatedAt: new Date() };
  if (patch.soundEnabled !== undefined) values.soundEnabled = patch.soundEnabled;
  if (patch.reducedMotion !== undefined) values.reducedMotion = patch.reducedMotion;
  if (patch.ageGroup !== undefined) values.ageGroup = patch.ageGroup;
  const [row] = await db.update(families).set(values).where(eq(families.id, familyId)).returning();
  if (!row) throw notFound('Không tìm thấy gia đình');
  return toPublicSettings(row);
}

/** Đăng xuất mọi phiên phụ huynh của gia đình. */
export async function bumpSessionVersion(db: Database, familyId: string): Promise<void> {
  await db
    .update(families)
    .set({ sessionVersion: sql`${families.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(families.id, familyId));
}
