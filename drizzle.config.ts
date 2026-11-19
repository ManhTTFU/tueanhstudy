import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });
config();

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Drizzle Kit dùng kết nối trực tiếp (không qua PgBouncer) nếu có.
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || 'postgresql://localhost:5432/be_vui_hoc_toan',
  },
  strict: true,
  verbose: true,
});
