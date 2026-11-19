import { eq, sql } from 'drizzle-orm';
import { appSettings, type AppSettingsRow } from '../../db/schema.js';
import type { Database } from '../db.js';

export interface PublicSettings {
  soundEnabled: boolean;
  reducedMotion: boolean;
  pinConfigured: boolean;
  familyCodeEnabled: boolean;
}

/** Đảm bảo dòng cài đặt (id = 1) tồn tại rồi trả về. */
export async function getSettingsRow(db: Database, forUpdate = false): Promise<AppSettingsRow> {
  await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
  const query = db.select().from(appSettings).where(eq(appSettings.id, 1));
  const rows = forUpdate ? await query.for('update') : await query;
  const row = rows[0];
  if (!row) throw new Error('Không đọc được cài đặt');
  return row;
}

export function toPublicSettings(row: AppSettingsRow): PublicSettings {
  return {
    soundEnabled: row.soundEnabled,
    reducedMotion: row.reducedMotion,
    pinConfigured: row.pinHash !== null,
    familyCodeEnabled: row.familyCodeHash !== null,
  };
}

export async function getPublicSettings(db: Database): Promise<PublicSettings> {
  return toPublicSettings(await getSettingsRow(db));
}

export async function updateSettings(
  db: Database,
  patch: { soundEnabled?: boolean | undefined; reducedMotion?: boolean | undefined },
): Promise<PublicSettings> {
  await getSettingsRow(db);
  const values: Partial<AppSettingsRow> = { updatedAt: new Date() };
  if (patch.soundEnabled !== undefined) values.soundEnabled = patch.soundEnabled;
  if (patch.reducedMotion !== undefined) values.reducedMotion = patch.reducedMotion;
  const [row] = await db.update(appSettings).set(values).where(eq(appSettings.id, 1)).returning();
  return toPublicSettings(row!);
}

export async function bumpSessionVersion(db: Database): Promise<void> {
  await db
    .update(appSettings)
    .set({ sessionVersion: sql`${appSettings.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(appSettings.id, 1));
}
