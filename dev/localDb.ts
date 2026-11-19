/**
 * Database dành cho phát triển local khi CHƯA có DATABASE_URL:
 * PGlite (PostgreSQL chạy bằng WebAssembly), dữ liệu lưu ở thư mục .data/pglite.
 * KHÔNG dùng cho production (production luôn dùng Neon qua DATABASE_URL).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { schema } from '../db/schema.js';
import type { Database } from '../server/db.js';

const MIGRATIONS = join(import.meta.dirname, '..', 'db', 'migrations');

/** Tạo database PGlite đã chạy migration. `dataDir` = undefined => chỉ trong bộ nhớ. */
export async function createPgliteDatabase(dataDir?: string): Promise<{ db: Database; close: () => Promise<void> }> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Database, close: () => client.close() };
}

export const LOCAL_DATA_DIR = join(import.meta.dirname, '..', '.data', 'pglite');
