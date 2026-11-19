/**
 * Kiểm tra migration 0002 (nhiều gia đình) trên một database CŨ có dữ liệu:
 * dữ liệu hiện có phải chuyển nguyên vẹn thành gia đình đầu tiên "Gia đình 1".
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import { schema } from '../db/schema';
import type { Database } from '../server/db';
import { handleApiRequest } from '../server/router';
import { hashPin } from '../server/auth';

const MIGRATIONS = join(import.meta.dirname, '..', 'db', 'migrations');

/** Thư mục migration chỉ gồm `count` bước đầu tiên. */
function partialMigrations(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'bvht-mig-'));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe('Migration nhiều gia đình', () => {
  it('chuyển dữ liệu cũ thành "Gia đình 1", giữ PIN, mã, kẹo, lịch sử', async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    const oldDir = partialMigrations(2);
    try {
      await migrate(db, { migrationsFolder: oldDir });
      const pinHash = await hashPin('2468');
      const codeHash = await hashPin('135790');
      await client.exec(`
        INSERT INTO app_settings (id, sound_enabled, reduced_motion, pin_hash, session_secret, session_version, family_code_hash, family_version)
          VALUES (1, false, true, '${pinHash}', 'bi-mat-cu-du-dai-16', 3, '${codeHash}', 2);
        INSERT INTO progress (id, total_candies, total_completed_quizzes, total_correct_answers, total_incorrect_answers, gifts_opened)
          VALUES (1, 1, 1, 10, 0, 0);
        INSERT INTO quiz_sessions (id, chapter_id, chapter_name, status, questions, total_questions, correct_answers, score, is_perfect_score, candies_earned, completed_at)
          VALUES ('11111111-1111-4111-8111-111111111111', 'number-recognition', 'Làm quen mặt số', 'completed', '[]', 10, 10, 10, true, 1, now());
        INSERT INTO rewards (reward_type, reward_code, quantity, source_session_id, dedupe_key)
          VALUES ('candy', 'candy', 1, '11111111-1111-4111-8111-111111111111', 'session:11111111-1111-4111-8111-111111111111:candy');
        INSERT INTO chapter_progress (chapter_id, total_sessions, perfect_sessions, best_score, total_correct)
          VALUES ('number-recognition', 1, 1, 10, 10);
      `);

      // Chạy migration mới nhất trên database cũ
      await migrate(db, { migrationsFolder: MIGRATIONS });

      const fam = await client.query<{ id: string; name: string; pin_hash: string; code_hash: string; session_version: number; family_version: number; sound_enabled: boolean; reduced_motion: boolean }>(
        'select * from families',
      );
      expect(fam.rows).toHaveLength(1);
      const f = fam.rows[0]!;
      expect(f).toMatchObject({ name: 'Gia đình 1', pin_hash: pinHash, code_hash: codeHash, session_version: 3, family_version: 2, sound_enabled: false, reduced_motion: true });
      for (const table of ['progress', 'quiz_sessions', 'rewards', 'chapter_progress']) {
        const r = await client.query<{ n: number; fam: number }>(`select count(*)::int as n, count(*) filter (where family_id = '${f.id}')::int as fam from ${table}`);
        expect(r.rows[0]!.n).toBeGreaterThan(0);
        expect(r.rows[0]!.fam).toBe(r.rows[0]!.n);
      }
      const settings = await client.query('select * from app_settings');
      expect(Object.keys(settings.rows[0] as object).sort()).toEqual(['id', 'session_secret', 'updated_at']);

      // Đăng nhập được bằng tên + mã cũ, thấy đúng kẹo cũ
      const login = await handleApiRequest(
        { method: 'POST', path: 'family/login', query: {}, headers: { 'x-bvht-client': '1' }, body: { name: 'gia dinh 1', code: '135790' }, ip: '10.7.0.1', secure: true },
        db as unknown as Database,
      );
      expect(login.status).toBe(200);
      const set = login.headers!['Set-Cookie'] as string[];
      const familyCookie = set.find((c) => c.startsWith('bvht_family='))!.split(';')[0]!;
      const summary = await handleApiRequest(
        { method: 'GET', path: 'summary', query: {}, headers: { cookie: familyCookie }, body: null, ip: '10.7.0.2', secure: true },
        db as unknown as Database,
      );
      expect(summary.body).toMatchObject({ totals: { totalCandies: 1, totalCompletedQuizzes: 1 }, settings: { familyName: 'Gia đình 1', soundEnabled: false } });
    } finally {
      await client.close();
      rmSync(oldDir, { recursive: true, force: true });
    }
  });

  it('database trống: không tạo gia đình nào', async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    expect((await client.query('select * from families')).rows).toHaveLength(0);
    await client.close();
  });
});
