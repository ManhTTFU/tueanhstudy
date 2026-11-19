import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { quizSessions, rewards } from '../db/schema';
import { createPgliteDatabase } from '../dev/localDb';
import type { Database } from '../server/db';
import { resetRateLimits } from '../server/rateLimit';
import { handleApiRequest, type ApiRequest } from '../server/router';
import type { Question } from '../src/engine/types';

let db: Database;
let close: () => Promise<void>;
let cookie = '';
let ipCounter = 0;

beforeAll(async () => {
  ({ db, close } = await createPgliteDatabase());
});
afterAll(async () => close());
beforeEach(() => resetRateLimits());

async function call(method: string, path: string, body?: unknown, opts: { auth?: boolean; csrf?: boolean; ip?: string; query?: Record<string, string> } = {}) {
  const headers: Record<string, string | undefined> = {};
  if (opts.csrf !== false) headers['x-bvht-client'] = '1';
  if (opts.auth) headers.cookie = cookie;
  const req: ApiRequest = {
    method,
    path,
    query: opts.query ?? {},
    headers,
    body,
    ip: opts.ip ?? `10.0.0.${++ipCounter % 250}`,
    secure: true,
  };
  return handleApiRequest(req, db);
}

/** Lùi thời điểm bắt đầu phiên để vượt thời gian làm bài tối thiểu. */
async function ageSession(id: string, ms = 60_000) {
  await db
    .update(quizSessions)
    .set({ startedAt: sql`${quizSessions.startedAt} - (${ms} * interval '1 millisecond')` })
    .where(eq(quizSessions.id, id));
}

async function playQuiz(chapterId: string, wrongOnFirst = 0) {
  const start = await call('POST', 'quiz/sessions', { chapterId });
  expect(start.status).toBe(200);
  const { sessionId, questions } = start.body as { sessionId: string; questions: Question[] };
  await ageSession(sessionId);
  const answers = questions.map((q, i) => {
    const wrong = q.options.find((o) => o !== q.correctAnswer)!;
    return { questionId: q.id, attempts: i < wrongOnFirst ? [wrong, q.correctAnswer] : [q.correctAnswer] };
  });
  const complete = await call('POST', `quiz/sessions/${sessionId}/complete`, { answers });
  return { sessionId, questions, answers, complete };
}

describe('API cơ bản', () => {
  it('health kiểm tra kết nối database', async () => {
    const r = await call('GET', 'health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, database: 'connected' });
  });

  it('danh sách chương và summary rỗng ban đầu', async () => {
    const chapters = await call('GET', 'chapters');
    expect((chapters.body as { chapters: { id: string }[] }).chapters.map((c) => c.id)).toEqual([
      'number-recognition',
      'object-counting',
      'number-finding',
      ...Array.from({ length: 9 }, (_, i) => [`number-recognition-${i * 10 + 11}-${i * 10 + 20}`, `number-finding-${i * 10 + 11}-${i * 10 + 20}`]).flat(),
    ]);
    const summary = await call('GET', 'summary');
    expect(summary.body).toMatchObject({ totals: { totalCandies: 0, totalCompletedQuizzes: 0 }, overallProgress: 0 });
  });

  it('API không tồn tại => 404, sai phương thức => 405', async () => {
    expect((await call('GET', 'khong-co')).status).toBe(404);
    expect((await call('DELETE', 'summary')).status).toBe(405);
  });

  it('request ghi dữ liệu thiếu header chống CSRF => 403', async () => {
    expect((await call('POST', 'quiz/sessions', { chapterId: 'number-recognition' }, { csrf: false })).status).toBe(403);
  });
});

describe('Luồng làm bài + phần thưởng', () => {
  it('chương học không tồn tại / dữ liệu sai => lỗi', async () => {
    expect((await call('POST', 'quiz/sessions', { chapterId: 'abc' })).status).toBe(404);
    expect((await call('POST', 'quiz/sessions', {})).status).toBe(400);
  });

  it('server sinh 10 câu hỏi hợp lệ cho cả 2 chương', async () => {
    for (const chapterId of ['number-recognition', 'object-counting']) {
      const r = await call('POST', 'quiz/sessions', { chapterId });
      const qs = (r.body as { questions: Question[] }).questions;
      expect(qs).toHaveLength(10);
      expect(new Set(qs.map((q) => q.id)).size).toBe(10);
    }
  });

  it('nộp bài quá nhanh bị từ chối (không tin client)', async () => {
    const start = await call('POST', 'quiz/sessions', { chapterId: 'number-recognition' });
    const { sessionId, questions } = start.body as { sessionId: string; questions: Question[] };
    const answers = questions.map((q) => ({ questionId: q.id, attempts: [q.correctAnswer] }));
    const r = await call('POST', `quiz/sessions/${sessionId}/complete`, { answers });
    expect(r.status).toBe(422);
  });

  it('nộp đáp án giả mạo bị từ chối', async () => {
    const start = await call('POST', 'quiz/sessions', { chapterId: 'number-recognition' });
    const { sessionId, questions } = start.body as { sessionId: string; questions: Question[] };
    await ageSession(sessionId);
    // Gửi đáp án không thuộc phương án
    const answers = questions.map((q) => ({ questionId: q.id, attempts: [99] }));
    expect((await call('POST', `quiz/sessions/${sessionId}/complete`, { answers })).status).toBe(422);
  });

  it('chấm điểm theo lần đầu; 10/10 nhận 1 kẹo; gọi lặp KHÔNG cộng trùng', async () => {
    const first = await playQuiz('number-recognition', 2);
    expect(first.complete.status).toBe(200);
    expect(first.complete.body).toMatchObject({ correctAnswers: 8, incorrectAnswers: 2, score: 8, candiesEarned: 0 });

    const perfect = await playQuiz('number-recognition');
    expect(perfect.complete.body).toMatchObject({ score: 10, isPerfectScore: true, candiesEarned: 1, percent: 100 });
    const earned = (perfect.complete.body as { rewards: { rewardCode: string }[] }).rewards.map((r) => r.rewardCode);
    expect(earned).toContain('candy');
    expect(earned).toContain('gold-medal');

    // Gọi lại API nhiều lần (kể cả song song)
    const replays = await Promise.all(
      [1, 2, 3].map(() => call('POST', `quiz/sessions/${perfect.sessionId}/complete`, { answers: perfect.answers })),
    );
    for (const r of replays) expect(r.body).toMatchObject({ alreadyCompleted: true, rewards: [] });

    const summary = (await call('GET', 'summary')).body as {
      totals: { totalCandies: number; totalCompletedQuizzes: number; totalCorrectAnswers: number; totalIncorrectAnswers: number };
    };
    expect(summary.totals).toMatchObject({
      totalCandies: 1,
      totalCompletedQuizzes: 2,
      totalCorrectAnswers: 18,
      totalIncorrectAnswers: 2,
    });
    const candyRows = await db.select().from(rewards).where(eq(rewards.rewardType, 'candy'));
    expect(candyRows).toHaveLength(1);
  });

  it('chương 2 dùng chung bộ máy chấm điểm & phần thưởng', async () => {
    const r = await playQuiz('object-counting', 1);
    expect(r.complete.body).toMatchObject({ score: 9, saved: true });
    const p = await playQuiz('object-counting');
    expect(p.complete.body).toMatchObject({ score: 10, candiesEarned: 1 });
  });

  it('cập nhật tiến độ chương và đánh dấu đã học thẻ', async () => {
    expect((await call('POST', 'learning/complete', { chapterId: 'number-recognition' })).status).toBe(200);
    const summary = (await call('GET', 'summary')).body as { chapters: { chapterId: string; stars: number; bestScore: number }[]; overallProgress: number };
    const nr = summary.chapters.find((c) => c.chapterId === 'number-recognition')!;
    expect(nr).toMatchObject({ stars: 3, bestScore: 10 });
    // 2/21 bài đạt 3 sao ("Tìm số" và 18 trò cấp 11–100 chưa chơi) => 6/63 sao ≈ 10%.
    expect(summary.overallProgress).toBe(10);
  });

  it('hộp quà: chưa đủ kẹo => 409; đủ kẹo mở 1 lần, gọi lặp cùng giftId không mở thêm', async () => {
    const giftId = crypto.randomUUID();
    expect((await call('POST', 'rewards/gifts/open', { giftId })).status).toBe(409);
    // Thêm 8 bài 10/10 => đủ 10 kẹo
    for (let i = 0; i < 8; i++) await playQuiz(i % 2 ? 'object-counting' : 'number-recognition');
    const overview = (await call('GET', 'rewards')).body as { totalCandies: number; giftsAvailable: number };
    expect(overview).toMatchObject({ totalCandies: 10, giftsAvailable: 1 });

    const opened = await call('POST', 'rewards/gifts/open', { giftId });
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ alreadyOpened: false, giftsAvailable: 0, isNewSticker: true });
    const again = await call('POST', 'rewards/gifts/open', { giftId });
    expect(again.body).toMatchObject({ alreadyOpened: true, stickerCode: (opened.body as { stickerCode: string }).stickerCode });
    expect((await call('POST', 'rewards/gifts/open', { giftId: crypto.randomUUID() })).status).toBe(409);
    const after = (await call('GET', 'rewards')).body as { totalCandies: number; giftsOpened: number };
    expect(after).toMatchObject({ totalCandies: 10, giftsOpened: 1 });
  });
});

describe('Khu vực phụ huynh & bảo mật', () => {
  it('API phụ huynh bị chặn khi chưa xác nhận (không thể vào bằng cách đổi URL)', async () => {
    for (const [m, p] of [
      ['GET', 'history'],
      ['GET', 'parent/stats'],
      ['GET', 'backup/export'],
      ['POST', 'backup/reset'],
      ['POST', 'backup/import'],
    ] as const) {
      expect((await call(m, p, { confirm: 'XOA' })).status).toBe(401);
    }
  });

  it('thiết lập PIN (lưu dạng băm), đăng nhập nhận cookie HttpOnly', async () => {
    expect((await call('POST', 'parent/setup', { pin: '12' })).status).toBe(400);
    const setup = await call('POST', 'parent/setup', { pin: '2468' });
    expect(setup.status).toBe(200);
    expect((await call('POST', 'parent/setup', { pin: '1111' })).status).toBe(409);

    const rows = await db.execute(sql`select pin_hash from app_settings where id = 1`);
    const hash = (rows as unknown as { rows: { pin_hash: string }[] }).rows[0]!.pin_hash;
    expect(hash).not.toContain('2468');
    expect(hash.startsWith('scrypt$')).toBe(true);

    const login = await call('POST', 'parent/login', { pin: '2468' });
    const setCookie = String(login.headers?.['Set-Cookie']);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    cookie = setCookie.split(';')[0]!;
    const session = await call('GET', 'parent/session', undefined, { auth: true });
    expect(session.body).toMatchObject({ authenticated: true, pinConfigured: true });
  });

  it('token giả mạo bị từ chối', async () => {
    const saved = cookie;
    cookie = 'bvht_parent=eyJ2IjoxLCJleHAiOjk5OTk5OTk5OTk5OTl9.fake';
    expect((await call('GET', 'parent/stats', undefined, { auth: true })).status).toBe(401);
    cookie = saved;
  });

  it('lịch sử có phân trang và chi tiết từng bài', async () => {
    const page1 = await call('GET', 'history', undefined, { auth: true, query: { page: '1', pageSize: '5' } });
    expect(page1.status).toBe(200);
    const body = page1.body as { items: { id: string }[]; total: number; totalPages: number };
    expect(body.items).toHaveLength(5);
    expect(body.total).toBe(12);
    expect(body.totalPages).toBe(3);
    const detail = await call('GET', `history/${body.items[0]!.id}`, undefined, { auth: true });
    expect((detail.body as { answers: unknown[] }).answers).toHaveLength(10);
    const stats = await call('GET', 'parent/stats', undefined, { auth: true });
    expect(stats.body).toMatchObject({ totals: { totalCompletedQuizzes: 12 } });
  });

  it('xuất JSON chính xác -> xoá -> nhập lại khôi phục đúng dữ liệu', async () => {
    const exported = await call('GET', 'backup/export', undefined, { auth: true });
    expect(exported.status).toBe(200);
    const backup = exported.body as { schemaVersion: number; format: string; data: { sessions: unknown[]; rewards: unknown[] } };
    expect(backup).toMatchObject({ format: 'be-vui-hoc-toan-backup', schemaVersion: 1 });
    expect(backup.data.sessions).toHaveLength(12);
    expect(JSON.stringify(backup)).not.toMatch(/pin_?hash|sessionSecret/i);
    const summaryBefore = (await call('GET', 'summary')).body;

    // Xoá cần xác nhận
    expect((await call('POST', 'backup/reset', {}, { auth: true })).status).toBe(400);
    expect((await call('POST', 'backup/reset', { confirm: 'XOA' }, { auth: true })).status).toBe(200);
    const empty = (await call('GET', 'summary')).body as { totals: { totalCandies: number; totalCompletedQuizzes: number } };
    expect(empty.totals).toMatchObject({ totalCandies: 0, totalCompletedQuizzes: 0 });
    // PIN vẫn còn sau khi xoá dữ liệu học
    expect((await call('GET', 'parent/session', undefined, { auth: true })).body).toMatchObject({ authenticated: true });

    // Nhập cần xác nhận + file hợp lệ
    expect((await call('POST', 'backup/import', { backup }, { auth: true })).status).toBe(400);
    const imported = await call('POST', 'backup/import', { confirm: true, backup }, { auth: true });
    expect(imported.status).toBe(200);
    expect((await call('GET', 'summary')).body).toEqual(summaryBefore);

    // Export lại giống hệt (trừ thời điểm xuất)
    const again = (await call('GET', 'backup/export', undefined, { auth: true })).body as typeof backup & { exportedAt: string };
    expect({ ...again, exportedAt: '' }).toEqual({ ...backup, exportedAt: '' });
  });

  it('nhập file không hợp lệ bị từ chối và KHÔNG làm mất dữ liệu', async () => {
    const before = (await call('GET', 'summary')).body;
    const bad = [
      { hello: 'world' },
      { format: 'be-vui-hoc-toan-backup', schemaVersion: 99, exportedAt: new Date().toISOString(), data: {} },
    ];
    const exported = (await call('GET', 'backup/export', undefined, { auth: true })).body as {
      data: { progress: { totalCandies: number } };
    };
    const tampered = structuredClone(exported);
    tampered.data.progress.totalCandies = 999; // không khớp danh sách phần thưởng
    for (const backup of [...bad, tampered]) {
      const r = await call('POST', 'backup/import', { confirm: true, backup }, { auth: true });
      expect(r.status).toBe(422);
    }
    expect((await call('GET', 'summary')).body).toEqual(before);
  });

  it('sai PIN 5 lần bị khoá tạm thời', async () => {
    for (let i = 0; i < 4; i++) expect((await call('POST', 'parent/login', { pin: '0000' })).status).toBe(401);
    expect((await call('POST', 'parent/login', { pin: '0000' })).status).toBe(401);
    // Đang khoá: kể cả PIN đúng cũng phải chờ
    expect((await call('POST', 'parent/login', { pin: '2468' })).status).toBe(423);
  });

  it('chống gửi yêu cầu liên tục (rate limit)', async () => {
    let limited = false;
    for (let i = 0; i < 15; i++) {
      const r = await call('POST', 'parent/login', { pin: '0000' }, { ip: '9.9.9.9' });
      if (r.status === 429) limited = true;
    }
    expect(limited).toBe(true);
  });

  it('cài đặt âm thanh lưu vào database', async () => {
    const r = await call('PUT', 'settings', { soundEnabled: false });
    expect(r.body).toMatchObject({ soundEnabled: false });
    expect((await call('GET', 'settings')).body).toMatchObject({ soundEnabled: false, pinConfigured: true });
  });
});

describe('Khoá cấp độ (cơ sở dữ liệu riêng, bắt đầu từ trống)', () => {
  it('cấp 11–20 bị server chặn tới khi đạt >= 8 điểm ở cả hai trò cấp 1–10', async () => {
    const fresh = await createPgliteDatabase();
    const callFresh = (path: string, body: unknown) =>
      handleApiRequest(
        { method: 'POST', path, query: {}, headers: { 'x-bvht-client': '1' }, body, ip: `10.9.0.${++ipCounter % 250}`, secure: true },
        fresh.db,
      );
    const playFresh = async (chapterId: string, wrongOnFirst: number) => {
      const start = await callFresh('quiz/sessions', { chapterId });
      expect(start.status).toBe(200);
      const { sessionId, questions } = start.body as { sessionId: string; questions: Question[] };
      await fresh.db
        .update(quizSessions)
        .set({ startedAt: sql`${quizSessions.startedAt} - interval '60 seconds'` })
        .where(eq(quizSessions.id, sessionId));
      const answers = questions.map((q, i) => ({
        questionId: q.id,
        attempts: i < wrongOnFirst ? [q.options.find((o) => o !== q.correctAnswer)!, q.correctAnswer] : [q.correctAnswer],
      }));
      return callFresh(`quiz/sessions/${sessionId}/complete`, { answers });
    };
    try {
      const locked = await callFresh('quiz/sessions', { chapterId: 'number-recognition-11-20' });
      expect(locked.status).toBe(403);
      expect(locked.body).toMatchObject({ error: { code: 'level_locked' } });

      expect((await playFresh('number-recognition', 1)).body).toMatchObject({ score: 9 });
      expect((await callFresh('quiz/sessions', { chapterId: 'number-finding-11-20' })).status).toBe(403);
      expect((await playFresh('number-finding', 3)).body).toMatchObject({ score: 7 });
      expect((await callFresh('quiz/sessions', { chapterId: 'number-finding-11-20' })).status).toBe(403);
      expect((await playFresh('number-finding', 2)).body).toMatchObject({ score: 8 });

      const done = await playFresh('number-recognition-11-20', 0);
      expect(done.body).toMatchObject({ score: 10, candiesEarned: 1 });
      expect((done.body as { rewards: { rewardCode: string }[] }).rewards.map((r) => r.rewardCode)).toContain('sports-medal');
      expect((await playFresh('number-finding-11-20', 0)).body).toMatchObject({ score: 10 });
    } finally {
      await fresh.close();
    }
  });
});

describe('Trò chơi phụ "Tìm số"', () => {
  it('trò "Tìm số" dùng chung bộ máy, câu hỏi "Đâu là số ...?", tặng sticker kính lúp khi 10/10', async () => {
    const p = await playQuiz('number-finding');
    expect(p.complete.body).toMatchObject({ score: 10, candiesEarned: 1 });
    const stickers = (p.complete.body as { rewards: { rewardCode: string }[] }).rewards.map((r) => r.rewardCode);
    expect(stickers).toContain('magnifier');
  });
});

describe('Mã gia đình (cơ sở dữ liệu riêng)', () => {
  it('chưa bật thì mở; bật rồi thì máy lạ bị chặn, nhập đúng mã thì vào được', async () => {
    const fresh = await createPgliteDatabase();
    /** Mỗi "máy" có hũ cookie riêng. */
    const device = () => {
      const jar: Record<string, string> = {};
      return async (method: string, path: string, body?: unknown) => {
        const res = await handleApiRequest(
          {
            method,
            path,
            query: {},
            headers: {
              'x-bvht-client': '1',
              cookie: Object.entries(jar)
                .map(([k, v]) => `${k}=${v}`)
                .join('; '),
            },
            body,
            ip: `10.8.0.${++ipCounter % 250}`,
            secure: true,
          },
          fresh.db,
        );
        const set = res.headers?.['Set-Cookie'];
        for (const c of Array.isArray(set) ? set : set ? [set] : []) {
          const [pair] = c.split(';');
          const [k, v] = pair!.split('=');
          if (v) jar[k!] = v;
          else delete jar[k!];
        }
        return res;
      };
    };
    try {
      const parent = device();
      const stranger = device();

      // Chưa bật: ai cũng vào được.
      expect((await stranger('GET', 'summary')).status).toBe(200);
      expect((await stranger('GET', 'family/status')).body).toEqual({ enabled: false, unlocked: true });

      // Phụ huynh đặt PIN rồi bật mã gia đình (chỉ phụ huynh mới đặt được).
      expect((await stranger('PUT', 'family/code', { code: '123456' })).status).toBe(401);
      expect((await parent('POST', 'parent/setup', { pin: '2468' })).status).toBe(200);
      expect((await parent('PUT', 'family/code', { code: '12' })).status).toBe(400);
      expect((await parent('PUT', 'family/code', { code: '123456' })).body).toEqual({ enabled: true });
      const rows = await fresh.db.execute(sql`select family_code_hash from app_settings where id = 1`);
      expect((rows as unknown as { rows: { family_code_hash: string }[] }).rows[0]!.family_code_hash).toMatch(/^scrypt\$/);

      // Máy phụ huynh vẫn dùng được; máy lạ bị chặn mọi API trừ health/status/unlock.
      expect((await parent('GET', 'summary')).status).toBe(200);
      const blocked = await stranger('POST', 'quiz/sessions', { chapterId: 'number-recognition' });
      expect(blocked.status).toBe(401);
      expect(blocked.body).toMatchObject({ error: { code: 'family_required' } });
      expect((await stranger('GET', 'summary')).status).toBe(401);
      expect((await stranger('GET', 'health')).status).toBe(200);
      expect((await stranger('GET', 'family/status')).body).toEqual({ enabled: true, unlocked: false });

      // Token giả không qua được.
      const forged = await handleApiRequest(
        { method: 'GET', path: 'summary', query: {}, headers: { cookie: 'bvht_family=eyJmIjoyLCJleHAiOjk5OTk5OTk5OTk5OTl9.fake' }, body: null, ip: '10.8.1.1', secure: true },
        fresh.db,
      );
      expect(forged.status).toBe(401);

      // Sai mã: báo còn mấy lần; đúng mã: vào được và được nhớ.
      expect((await stranger('POST', 'family/unlock', { code: '000000' })).body).toMatchObject({ error: { code: 'wrong_family_code' } });
      expect((await stranger('POST', 'family/unlock', { code: '123456' })).status).toBe(200);
      expect((await stranger('GET', 'summary')).status).toBe(200);

      // Cookie gia đình KHÔNG dùng được làm cookie phụ huynh.
      expect((await stranger('GET', 'history')).status).toBe(401);

      // Đăng xuất mọi máy: máy lạ phải nhập lại, máy phụ huynh vẫn giữ.
      expect((await parent('POST', 'family/logout-all')).status).toBe(200);
      expect((await stranger('GET', 'summary')).status).toBe(401);
      expect((await parent('GET', 'summary')).status).toBe(200);

      // Máy mới quên mã: phụ huynh đăng nhập bằng PIN là vào được (khôi phục).
      const newDevice = device();
      expect((await newDevice('GET', 'summary')).status).toBe(401);
      expect((await newDevice('POST', 'parent/login', { pin: '2468' })).status).toBe(200);
      expect((await newDevice('GET', 'summary')).status).toBe(200);

      // Sai 5 lần => khoá 5 phút, kể cả khi nhập đúng.
      const attacker = device();
      for (let i = 0; i < 5; i++) await attacker('POST', 'family/unlock', { code: '999999' });
      expect((await attacker('POST', 'family/unlock', { code: '123456' })).status).toBe(423);

      // Tắt mã: mở lại cho mọi máy.
      expect((await parent('PUT', 'family/code', { code: null })).body).toEqual({ enabled: false });
      expect((await stranger('GET', 'summary')).status).toBe(200);
    } finally {
      await fresh.close();
    }
  });
});
