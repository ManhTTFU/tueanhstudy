/**
 * Kết nối database – CHỈ chạy phía server (Vercel Functions / dev server).
 * DATABASE_URL không bao giờ được đưa vào bundle frontend.
 */
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { schema } from '../db/schema.js';

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

let override: Database | null = null;
let cached: Database | null = null;

/** Dùng cho dev server (PGlite) và kiểm thử. */
export function setDatabase(db: Database | null): void {
  override = db;
}

export function getDb(): Database {
  if (override) return override;
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Thiếu biến môi trường DATABASE_URL');
  }
  const pool = new pg.Pool({
    connectionString: url,
    // Serverless: giữ ít kết nối mỗi instance, dùng chuỗi "pooled" của Neon.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  pool.on('error', (err) => console.error('[db] pool error', err.message));
  cached = drizzle(pool, { schema }) as unknown as Database;
  return cached;
}
