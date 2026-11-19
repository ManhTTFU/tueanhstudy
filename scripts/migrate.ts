/**
 * Chạy migration database.
 *   npm run db:migrate
 * - Có DATABASE_URL_UNPOOLED / DATABASE_URL (.env.local / .env / biến môi trường) => migrate Neon/PostgreSQL.
 *   Ưu tiên kết nối TRỰC TIẾP (DATABASE_URL_UNPOOLED) vì migration không nên đi qua PgBouncer.
 * - Không có => migrate database PGlite local tại .data/pglite.
 * Migration chỉ THÊM thay đổi, không xoá dữ liệu hiện có.
 */
import { config } from 'dotenv';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const migrationsFolder = join(import.meta.dirname, '..', 'db', 'migrations');

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    const { createPgliteDatabase, LOCAL_DATA_DIR } = await import('../dev/localDb.js');
    const { close } = await createPgliteDatabase(LOCAL_DATA_DIR);
    await close();
    console.log(`✔ Đã migrate database PGlite local (${LOCAL_DATA_DIR}).`);
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    const host = new URL(url).host;
    console.log(`✔ Đã migrate database tại ${host}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('✘ Migration thất bại:', err instanceof Error ? err.message : err);
  process.exit(1);
});
