import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { challengeRuns, quizSessions, rewards } from '../db/schema';
import { createPgliteDatabase } from '../dev/localDb';
import type { Database } from '../server/db';
import { resetRateLimits } from '../server/rateLimit';
import { handleApiRequest, type ApiRequest } from '../server/router';
import { CHAPTERS } from '../src/chapters/registry';
import type { Question } from '../src/engine/types';

let db: Database;
let close: () => Promise<void>;
let cookie = '';
/** Cookie đăng nhập gia đình "Nhà Test" (mọi request trong các test chính đều gửi kèm). */
let familyCookie = '';
let ipCounter = 0;

/** Lấy giá trị một cookie trong header Set-Cookie của phản hồi. */
function cookieFrom(res: { headers?: Record<string, string | string[]> }, name: string): string {
  const set = res.headers?.['Set-Cookie'];
  for (const c of Array.isArray(set) ? set : set ? [set] : []) {
    const pair = c.split(';')[0]!;
    if (pair.startsWith(`${name}=`)) return pair;
  }
  return '';
}

/**
 * Một "máy" độc lập có hũ cookie riêng, gọi API trên database chỉ định.
 * Dùng cho các test cần database riêng / nhiều gia đình.
 */
function device(database: Database) {
  const jar: Record<string, string> = {};
  return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
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
          ...headers,
        },
        body,
        ip: `10.8.${Math.floor(++ipCounter / 250) % 250}.${ipCounter % 250}`,
        secure: true,
      },
      database,
    );
    const set = res.headers?.['Set-Cookie'];
    for (const c of Array.isArray(set) ? set : set ? [set] : []) {
      const [pair] = c.split(';');
      const idx = pair!.indexOf('=');
      const k = pair!.slice(0, idx);
      const v = pair!.slice(idx + 1);
      if (v) jar[k] = v;
      else delete jar[k];
    }
    return res;
  };
}

beforeAll(async () => {
  ({ db, close } = await createPgliteDatabase());
  const reg = await handleApiRequest(
    { method: 'POST', path: 'family/register', query: {}, headers: { 'x-bvht-client': '1' }, body: { name: 'Nhà Test', code: '111111' }, ip: '10.0.9.9', secure: true },
    db,
  );
  expect(reg.status).toBe(200);
  familyCookie = cookieFrom(reg, 'bvht_family');
  expect(familyCookie).not.toBe('');
});
afterAll(async () => close());
beforeEach(() => resetRateLimits());

async function call(method: string, path: string, body?: unknown, opts: { auth?: boolean; csrf?: boolean; ip?: string; query?: Record<string, string> } = {}) {
  const headers: Record<string, string | undefined> = {};
  if (opts.csrf !== false) headers['x-bvht-client'] = '1';
  headers.cookie = [familyCookie, opts.auth ? cookie : ''].filter(Boolean).join('; ');
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
    const wrong = q.input ? q.correctAnswer + 1 : q.options.find((o) => o !== q.correctAnswer)!;
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
    const ids = (chapters.body as { chapters: { id: string }[] }).chapters.map((c) => c.id);
    // Chương gốc đứng trước, đủ mọi chương đang bật.
    expect(ids.slice(0, 5)).toEqual(['number-recognition', 'object-counting', 'number-finding', 'arithmetic', 'brain']);
    expect([...ids].sort()).toEqual(CHAPTERS.filter((c) => c.enabled).map((c) => c.id).sort());
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
    // Chỉ tính trò đã mở khoá: cấp 1–10 (2 trò) + Bé tập đếm + Cộng trừ phạm vi 5 (2 trò)
    // + cấp 1 của 11 chủ đề tư duy ("Sân chơi trí tuệ" chỉ là cửa vào, không tính); "Tìm số" chưa
    // chơi nên cấp 11–20 còn khoá => 6/48 sao ≈ 13%.
    expect(summary.overallProgress).toBe(13);
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

    const rows = await db.execute(sql`select pin_hash from families`);
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
    expect(backup).toMatchObject({ format: 'be-vui-hoc-toan-backup', schemaVersion: 2 });
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

    // Export lại giống hệt (trừ thời điểm xuất và mã phiên/hộp quà – được cấp mới khi nhập)
    const again = (await call('GET', 'backup/export', undefined, { auth: true })).body as typeof backup & { exportedAt: string };
    const noIds = (x: unknown) => JSON.parse(JSON.stringify(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'ID'));
    expect(noIds({ ...again, exportedAt: '' })).toEqual(noIds({ ...backup, exportedAt: '' }));
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
    const dev = device(fresh.db);
    expect((await dev('POST', 'family/register', { name: 'Nhà Cấp Độ', code: '2222' })).status).toBe(200);
    const callFresh = (path: string, body: unknown) => dev('POST', path, body);
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

      // Tiến độ tổng chỉ tính trò đã mở: cấp 1–10 (2+2 sao), Bé tập đếm (0), cấp 11–20 (3+3),
      // cấp 21–30 vừa mở (0+0), Cộng trừ phạm vi 5 (0+0), 11 chủ đề tư duy (0) => 10/60 sao ≈ 17%.
      const summary = await dev('GET', 'summary');
      expect((summary.body as { overallProgress: number }).overallProgress).toBe(17);
    } finally {
      await fresh.close();
    }
  });
});

describe('Cộng trừ (API)', () => {
  it('server sinh và chấm phép cộng; 10/10 tặng sticker bàn tính; phạm vi 10 còn khoá', async () => {
    const p = await playQuiz('arithmetic');
    expect(p.questions).toHaveLength(10);
    for (const q of p.questions) expect(q.prompt).toMatch(/^\d+ \+ \d+ = \?$/);
    expect(p.complete.body).toMatchObject({ score: 10, candiesEarned: 1 });
    expect((p.complete.body as { rewards: { rewardCode: string }[] }).rewards.map((r) => r.rewardCode)).toContain('abacus');
    const locked = await call('POST', 'quiz/sessions', { chapterId: 'arithmetic-add-10' });
    expect(locked.body).toMatchObject({ error: { code: 'level_locked' } });
    const sub = await playQuiz('arithmetic-sub-5', 2);
    expect(sub.complete.body).toMatchObject({ score: 8 });
    expect((await call('POST', 'quiz/sessions', { chapterId: 'arithmetic-add-10' })).status).toBe(200);
  });
});

describe('Sân chơi tư duy (API)', () => {
  it('chọn hình: server chấm, mở cấp 2 sau khi đạt 8 điểm cấp 1; lịch sử hiện tên hình', async () => {
    expect((await call('POST', 'quiz/sessions', { chapterId: 'dd-colors-2' })).body).toMatchObject({ error: { code: 'level_locked' } });
    const p = await playQuiz('dd-colors', 2);
    expect(p.complete.body).toMatchObject({ score: 8 });
    expect((await call('POST', 'quiz/sessions', { chapterId: 'dd-colors-2' })).status).toBe(200);
    const detail = await call('GET', `history/${p.sessionId}`, undefined, { auth: true });
    const answers = (detail.body as { answers: { correctLabel: string | null }[] }).answers;
    expect(answers.every((a) => typeof a.correctLabel === 'string')).toBe(true);
  });
});

describe('Sân chơi trí tuệ (API)', () => {
  it('chỉ là cửa vào các chủ đề: không mở bài được; 5 trò kỹ năng cũ đã tắt', async () => {
    for (const id of ['brain', 'brain-attention', 'brain-logic', 'brain-memory', 'brain-imagine']) {
      expect((await call('POST', 'quiz/sessions', { chapterId: id })).status).toBe(404);
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

describe('Nhiều gia đình (cơ sở dữ liệu riêng)', () => {
  const OLD_INVITE = process.env.FAMILY_INVITE_CODE;
  const OLD_MAX = process.env.MAX_FAMILIES;
  afterAll(() => {
    if (OLD_INVITE === undefined) delete process.env.FAMILY_INVITE_CODE;
    else process.env.FAMILY_INVITE_CODE = OLD_INVITE;
    if (OLD_MAX === undefined) delete process.env.MAX_FAMILIES;
    else process.env.MAX_FAMILIES = OLD_MAX;
  });

  it('đăng ký cần mã mời (trừ gia đình đầu tiên), giới hạn số gia đình, tên không trùng', async () => {
    const fresh = await createPgliteDatabase();
    try {
      delete process.env.FAMILY_INVITE_CODE;
      process.env.MAX_FAMILIES = '3';
      const a = device(fresh.db);
      const status0 = await a('GET', 'family/status');
      expect(status0.body).toEqual({ loggedIn: false, registration: { open: true, inviteRequired: false, full: false } });
      // Chưa đăng nhập: mọi API dữ liệu bị chặn
      expect((await a('GET', 'summary')).body).toMatchObject({ error: { code: 'family_required' } });

      // Gia đình đầu tiên tạo tự do
      expect((await a('POST', 'family/register', { name: 'Nhà Tuệ Anh', code: '123456', pin: '2468' })).status).toBe(200);
      expect((await a('GET', 'family/status')).body).toMatchObject({ loggedIn: true, family: { name: 'Nhà Tuệ Anh', hasCode: true } });
      // Đăng ký kèm PIN => vào luôn khu phụ huynh
      expect((await a('GET', 'parent/session')).body).toEqual({ pinConfigured: true, authenticated: true });

      // Gia đình thứ hai: chưa đặt mã mời trên server => đóng đăng ký
      const b = device(fresh.db);
      expect((await b('GET', 'family/status')).body).toMatchObject({ registration: { open: false, inviteRequired: true } });
      expect((await b('POST', 'family/register', { name: 'Nhà Bin', code: '654321' })).body).toMatchObject({ error: { code: 'registration_closed' } });
      process.env.FAMILY_INVITE_CODE = 'moi-ban-be';
      expect((await b('POST', 'family/register', { name: 'Nhà Bin', code: '654321', invite: 'sai' })).body).toMatchObject({ error: { code: 'wrong_invite' } });
      // Tên trùng (không phân biệt dấu / hoa thường / khoảng trắng)
      expect((await b('POST', 'family/register', { name: '  nha TUE   anh ', code: '654321', invite: 'moi-ban-be' })).status).toBe(409);
      expect((await b('POST', 'family/register', { name: 'Nhà Bin', code: '654321', invite: 'moi-ban-be' })).status).toBe(200);
      const c = device(fresh.db);
      expect((await c('POST', 'family/register', { name: 'Nhà Na', code: '777777', invite: 'moi-ban-be' })).status).toBe(200);
      // Đủ 3 gia đình
      const d = device(fresh.db);
      expect((await d('GET', 'family/status')).body).toMatchObject({ registration: { open: false, full: true } });
      expect((await d('POST', 'family/register', { name: 'Nhà Thứ Tư', code: '888888', invite: 'moi-ban-be' })).status).toBe(409);
    } finally {
      await fresh.close();
    }
  });

  it('dữ liệu mỗi gia đình tách riêng; đăng nhập bằng tên + mã hoặc PIN; khoá khi dò mã', async () => {
    const fresh = await createPgliteDatabase();
    try {
      process.env.FAMILY_INVITE_CODE = 'moi';
      delete process.env.MAX_FAMILIES;
      const a = device(fresh.db);
      const b = device(fresh.db);
      await a('POST', 'family/register', { name: 'Nhà A', code: '1111', pin: '1234' });
      await b('POST', 'family/register', { name: 'Nhà B', code: '2222', pin: '5678', invite: 'moi' });

      // Gia đình A chơi 1 bài 10/10
      const start = await a('POST', 'quiz/sessions', { chapterId: 'number-recognition' });
      const { sessionId, questions } = start.body as { sessionId: string; questions: Question[] };
      await fresh.db
        .update(quizSessions)
        .set({ startedAt: sql`${quizSessions.startedAt} - interval '60 seconds'` })
        .where(eq(quizSessions.id, sessionId));
      const answers = questions.map((q) => ({ questionId: q.id, attempts: [q.correctAnswer] }));
      expect((await a('POST', `quiz/sessions/${sessionId}/complete`, { answers })).body).toMatchObject({ candiesEarned: 1 });

      // Gia đình B không thấy gì của A, không nộp hộ được phiên của A
      expect(((await b('GET', 'summary')).body as { totals: { totalCandies: number } }).totals.totalCandies).toBe(0);
      expect(((await a('GET', 'summary')).body as { totals: { totalCandies: number } }).totals.totalCandies).toBe(1);
      expect((await b('POST', `quiz/sessions/${sessionId}/complete`, { answers })).status).toBe(404);
      expect((await b('GET', `history/${sessionId}`)).status).toBe(404);
      expect(((await b('GET', 'history')).body as { total: number }).total).toBe(0);
      // B cũng nhận được sticker "lần đầu 10/10" riêng của mình (dedupe theo gia đình)
      const s2 = await b('POST', 'quiz/sessions', { chapterId: 'number-recognition' });
      const b2 = s2.body as { sessionId: string; questions: Question[] };
      await fresh.db
        .update(quizSessions)
        .set({ startedAt: sql`${quizSessions.startedAt} - interval '60 seconds'` })
        .where(eq(quizSessions.id, b2.sessionId));
      const bDone = await b('POST', `quiz/sessions/${b2.sessionId}/complete`, {
        answers: b2.questions.map((q) => ({ questionId: q.id, attempts: [q.correctAnswer] })),
      });
      expect((bDone.body as { rewards: { rewardCode: string }[] }).rewards.map((r) => r.rewardCode)).toContain('gold-medal');

      // Token phụ huynh của A không dùng được cho gia đình B
      const aParent = device(fresh.db);
      await aParent('POST', 'family/login', { name: 'nha a', pin: '1234' });
      expect((await aParent('GET', 'parent/stats')).status).toBe(200);
      const parentA = (await a('POST', 'parent/login', { pin: '1234' })).headers?.['Set-Cookie'];
      const parentCookie = (Array.isArray(parentA) ? parentA : [String(parentA)]).find((x) => x.startsWith('bvht_parent='))!.split(';')[0]!;
      expect((await b('GET', 'parent/stats', undefined, { cookie: `${parentCookie}` })).status).toBe(401);

      // Máy mới: đăng nhập bằng tên + mã (không phân biệt dấu); sai mã thì báo chung chung
      const c = device(fresh.db);
      expect((await c('POST', 'family/login', { name: 'Nhà A', code: '9999' })).body).toMatchObject({ error: { code: 'wrong_family_login' } });
      expect((await c('POST', 'family/login', { name: 'Không Có', code: '1111' })).body).toMatchObject({ error: { code: 'wrong_family_login' } });
      expect((await c('POST', 'family/login', { name: 'nha a', code: '1111' })).status).toBe(200);
      expect(((await c('GET', 'summary')).body as { totals: { totalCandies: number } }).totals.totalCandies).toBe(1);
      // Đăng nhập bằng mã thì chưa phải phụ huynh
      expect((await c('GET', 'parent/stats')).status).toBe(401);

      // Token giả không qua được
      const forged = device(fresh.db);
      expect((await forged('GET', 'summary', undefined, { cookie: 'bvht_family=eyJmaWQiOiJ4IiwiZiI6MSwiZXhwIjo5OTk5OTk5OTk5OTk5fQ.fake' })).status).toBe(401);

      // Đổi mã: máy khác phải đăng nhập lại, máy đổi mã vẫn giữ
      expect((await aParent('PUT', 'family/code', { code: '4321' })).status).toBe(200);
      expect((await c('GET', 'summary')).status).toBe(401);
      expect((await aParent('GET', 'summary')).status).toBe(200);
      // Đổi tên gia đình
      expect((await aParent('PUT', 'family/name', { name: 'Nhà Bin' })).status).toBe(200);
      expect((await aParent('PUT', 'family/name', { name: 'Nhà B' })).status).toBe(409);

      // Sai mã 5 lần => khoá 5 phút, kể cả khi nhập đúng
      const attacker = device(fresh.db);
      for (let i = 0; i < 5; i++) await attacker('POST', 'family/login', { name: 'Nhà B', code: '0000' });
      expect((await attacker('POST', 'family/login', { name: 'Nhà B', code: '2222' })).status).toBe(423);

      // Đăng xuất gia đình trên máy
      expect((await aParent('POST', 'family/logout')).status).toBe(200);
      expect((await aParent('GET', 'summary')).status).toBe(401);
    } finally {
      await fresh.close();
    }
  });

  it('nhập bản sao lưu của gia đình A vào gia đình B không ảnh hưởng gia đình A', async () => {
    const fresh = await createPgliteDatabase();
    try {
      process.env.FAMILY_INVITE_CODE = 'moi';
      const a = device(fresh.db);
      const b = device(fresh.db);
      await a('POST', 'family/register', { name: 'Nhà A', code: '1111', pin: '1234' });
      await b('POST', 'family/register', { name: 'Nhà B', code: '2222', pin: '5678', invite: 'moi' });
      const start = await a('POST', 'quiz/sessions', { chapterId: 'object-counting' });
      const { sessionId, questions } = start.body as { sessionId: string; questions: Question[] };
      await fresh.db
        .update(quizSessions)
        .set({ startedAt: sql`${quizSessions.startedAt} - interval '60 seconds'` })
        .where(eq(quizSessions.id, sessionId));
      await a('POST', `quiz/sessions/${sessionId}/complete`, { answers: questions.map((q) => ({ questionId: q.id, attempts: [q.correctAnswer] })) });
      const backup = (await a('GET', 'backup/export')).body;
      expect((await b('POST', 'backup/import', { confirm: true, backup })).status).toBe(200);
      const sa = (await a('GET', 'summary')).body as { totals: unknown };
      const sb = (await b('GET', 'summary')).body as { totals: unknown };
      expect(sb.totals).toEqual(sa.totals);
      // Xoá dữ liệu B không đụng tới A
      expect((await b('POST', 'backup/reset', { confirm: 'XOA' })).status).toBe(200);
      expect(((await a('GET', 'summary')).body as { totals: { totalCandies: number } }).totals.totalCandies).toBe(1);
      expect(((await a('GET', 'history')).body as { total: number }).total).toBe(1);
    } finally {
      await fresh.close();
    }
  });
});

describe('Nhóm 5–9 tuổi (API)', () => {
  it('lưu nhóm tuổi trong cài đặt gia đình; dữ liệu sai => 400', async () => {
    expect((await call('GET', 'settings')).body).toMatchObject({ ageGroup: 'preschool' });
    expect((await call('PUT', 'settings', { ageGroup: 'teen' })).status).toBe(400);
    expect((await call('PUT', 'settings', { ageGroup: 'primary' })).body).toMatchObject({ ageGroup: 'primary' });
    expect((await call('GET', 'summary')).body).toMatchObject({ settings: { ageGroup: 'primary' } });
    await call('PUT', 'settings', { ageGroup: 'preschool' });
  });

  it('câu tự gõ: chấm theo lần gõ đầu, số không hợp lệ bị từ chối; cửa vào Tư duy toán không có bài', async () => {
    const { complete, questions } = await playQuiz('pm-mental', 2);
    expect(questions.every((q) => q.input && q.options.length === 0)).toBe(true);
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({ correctAnswers: 8, score: 8 });

    const start = await call('POST', 'quiz/sessions', { chapterId: 'pm-compare' });
    const { sessionId, questions: qs } = start.body as { sessionId: string; questions: Question[] };
    await ageSession(sessionId);
    const answers = qs.map((q) => ({ questionId: q.id, attempts: q.input ? [1.5, q.correctAnswer] : [q.correctAnswer] }));
    // Số thập phân: bị chặn ngay ở bước kiểm tra dữ liệu (400); số quá lớn: bị chặn khi chấm (422).
    expect((await call('POST', `quiz/sessions/${sessionId}/complete`, { answers })).status).toBe(400);
    const tooBig = qs.map((q) => ({ questionId: q.id, attempts: q.input ? [1_000_000, q.correctAnswer] : [q.correctAnswer] }));
    expect((await call('POST', `quiz/sessions/${sessionId}/complete`, { answers: tooBig })).status).toBe(422);
    expect((await call('POST', 'quiz/sessions', { chapterId: 'pm-think' })).status).toBe(404);
  });

  it('tiến độ tổng chỉ tính chương của nhóm tuổi đang chọn', async () => {
    const before = (await call('GET', 'summary')).body as { overallProgress: number };
    await call('PUT', 'settings', { ageGroup: 'primary' });
    const primary = (await call('GET', 'summary')).body as { overallProgress: number };
    // Đã chơi Tính nhẩm cấp 1 ở test trên => nhóm 5–9 tuổi có tiến độ > 0.
    expect(primary.overallProgress).toBeGreaterThan(0);
    expect(primary.overallProgress).not.toBe(before.overallProgress);
    await call('PUT', 'settings', { ageGroup: 'preschool' });
  });
});

describe('Nhóm 5–9 tuổi: xu, ôn câu sai, đổi quà, thử thách, xếp hạng (API)', () => {
  type Overview = { coins: { earned: number; spent: number; balance: number }; reviewCount: number; challengeBest: number; weekRank: number; weekCoins: number };
  const overview = async () => (await call('GET', 'primary/overview')).body as Overview;

  it('làm bài: đúng lần đầu 2 xu, thử lại 1 xu; câu sai vào danh sách ôn', async () => {
    // Dọn danh sách ôn (test trước có thể đã để lại câu sai trùng với câu sắp gặp).
    while ((await overview()).reviewCount > 0) await playQuiz('pm-review');
    const before = await overview();
    const { complete } = await playQuiz('pm-mental', 3);
    expect(complete.body).toMatchObject({ coinsEarned: 7 * 2 + 3 });
    const after = await overview();
    expect(after.coins.earned - before.coins.earned).toBe(17);
    expect(after.reviewCount - before.reviewCount).toBe(3);
    // 10/10 ở nhóm 5–9 tuổi: chỉ có xu, không kẹo / sticker / thành tích
    const perfect = await playQuiz('pm-mental');
    expect(perfect.complete.body).toMatchObject({ isPerfectScore: true, candiesEarned: 0, coinsEarned: 20, rewards: [], encouragement: 'XUẤT SẮC! CON LÀM ĐÚNG HẾT RỒI!' });
    // Nhóm 3–5 tuổi không có xu
    const { complete: pre } = await playQuiz('number-recognition');
    expect(pre.body).toMatchObject({ coinsEarned: 0 });
  });

  it('ôn câu sai: làm đúng ngay thì câu đó được xoá; hết câu => 409', async () => {
    let { reviewCount } = await overview();
    expect(reviewCount).toBeGreaterThan(0);
    while (reviewCount > 0) {
      const { complete, questions } = await playQuiz('pm-review');
      expect(complete.status).toBe(200);
      expect(questions.length).toBe(Math.min(10, reviewCount));
      expect(questions.every((q) => q.id.includes('|'))).toBe(true);
      const next = (await overview()).reviewCount;
      expect(next).toBe(reviewCount - questions.length);
      reviewCount = next;
    }
    const empty = await call('POST', 'quiz/sessions', { chapterId: 'pm-review' });
    expect(empty.status).toBe(409);
    expect(empty.body).toMatchObject({ error: { code: 'review_empty' } });
    // Bài ôn không hiện ở trang chủ / không tính tiến độ
    expect(CHAPTERS.find((c) => c.id === 'pm-review')?.review).toBe(true);
  });

  it('đổi quà: phụ huynh đặt quà, bé đổi khi đủ xu, bấm lặp không trừ hai lần', async () => {
    expect((await call('POST', 'shop/rewards', { name: 'Đi công viên', cost: 5 })).status).toBe(401);
    expect((await call('POST', 'shop/rewards', { name: '', cost: 5 }, { auth: true })).status).toBe(400);
    const added = await call('POST', 'shop/rewards', { name: 'Đi công viên', cost: 5 }, { auth: true });
    expect(added.status).toBe(200);
    await call('POST', 'shop/rewards', { name: 'Xe đạp mới', cost: 100_000 }, { auth: true });
    const shop = (await call('GET', 'shop')).body as { rewards: { id: string; name: string; cost: number }[]; coins: { balance: number } };
    const park = shop.rewards.find((r) => r.name === 'Đi công viên')!;
    const bike = shop.rewards.find((r) => r.name === 'Xe đạp mới')!;
    const rid = () => crypto.randomUUID();

    const tooMuch = await call('POST', 'shop/redeem', { rewardId: bike.id, redemptionId: rid() });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body).toMatchObject({ error: { code: 'not_enough_coins' } });

    const id = rid();
    const r1 = await call('POST', 'shop/redeem', { rewardId: park.id, redemptionId: id });
    expect(r1.status).toBe(200);
    const r2 = await call('POST', 'shop/redeem', { rewardId: park.id, redemptionId: id });
    expect((r2.body as { coins: { balance: number } }).coins.balance).toBe(shop.coins.balance - 5);
    const { redemptions } = r2.body as { redemptions: { id: string; deliveredAt: string | null }[] };
    expect(redemptions.filter((x) => x.id === id)).toHaveLength(1);

    expect((await call('POST', `shop/redemptions/${id}/deliver`)).status).toBe(401);
    const delivered = await call('POST', `shop/redemptions/${id}/deliver`, {}, { auth: true });
    expect((delivered.body as { redemptions: { id: string; deliveredAt: string | null }[] }).redemptions.find((x) => x.id === id)?.deliveredAt).toBeTruthy();

    // Bỏ quà: ẩn khỏi danh sách nhưng lịch sử đổi vẫn còn tên
    const removed = (await call('POST', `shop/rewards/${park.id}/remove`, {}, { auth: true })).body as { rewards: { id: string }[]; redemptions: { name: string }[] };
    expect(removed.rewards.some((r) => r.id === park.id)).toBe(false);
    expect(removed.redemptions.some((r) => r.name === 'Đi công viên')).toBe(true);
    expect((await call('POST', 'shop/redeem', { rewardId: park.id, redemptionId: rid() })).status).toBe(404);
  });

  it('thử thách 60 giây: server chấm, chặn trả lời quá nhanh / sai thứ tự, kỷ lục và xu', async () => {
    const before = await overview();
    const start = await call('POST', 'challenge');
    expect(start.status).toBe(200);
    const { runId, questions } = start.body as { runId: string; questions: { id: string; text: string; answer: number }[] };
    expect(questions.length).toBeGreaterThanOrEqual(60);
    for (const q of questions.slice(0, 20)) {
      const m = q.text.match(/^(\d+) ([+−]) (\d+)$/)!;
      expect(m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3])).toBe(q.answer);
    }
    const answers = questions.slice(0, 20).map((q, i) => ({ questionId: q.id, value: i < 15 ? q.answer : q.answer + 1 }));
    // Vừa bắt đầu đã nộp 20 câu => quá nhanh
    expect((await call('POST', `challenge/${runId}/complete`, { answers })).status).toBe(422);
    await db.update(challengeRuns).set({ startedAt: sql`${challengeRuns.startedAt} - interval '61 seconds'` }).where(eq(challengeRuns.id, runId));
    const swapped = [answers[1]!, answers[0]!, ...answers.slice(2)];
    expect((await call('POST', `challenge/${runId}/complete`, { answers: swapped })).status).toBe(422);
    const done = await call('POST', `challenge/${runId}/complete`, { answers });
    expect(done.body).toMatchObject({ correct: 15, wrong: 5, coinsEarned: 7, best: Math.max(15, before.challengeBest) });
    const again = await call('POST', `challenge/${runId}/complete`, { answers });
    expect(again.body).toMatchObject({ correct: 15, coinsEarned: 0, alreadyCompleted: true });
    const after = await overview();
    expect(after.challengeBest).toBe(Math.max(15, before.challengeBest));
    expect(after.coins.earned - before.coins.earned).toBe(7);
  });

  it('bảng xếp hạng: gia đình mình có mặt, xếp theo xu tuần này', async () => {
    const r = await call('GET', 'leaderboard');
    const body = r.body as { week: { name: string; coins: number; me: boolean; rank: number }[]; allTime: { me: boolean; coins: number }[] };
    const me = body.week.find((x) => x.me)!;
    expect(me).toMatchObject({ name: 'Nhà Test', rank: 1 });
    expect(me.coins).toBe((await overview()).weekCoins);
    expect(body.allTime.find((x) => x.me)!.coins).toBeGreaterThanOrEqual(me.coins);
  });

  it('sao lưu phiên bản 2 giữ xu, quà, lượt đổi quà, kỷ lục; file phiên bản 1 vẫn nhập được', async () => {
    const before = await overview();
    const exported = (await call('GET', 'backup/export', undefined, { auth: true })).body as {
      schemaVersion: number;
      data: Record<string, unknown[]> & { coins: unknown[]; redemptions: unknown[]; shopRewards: unknown[] };
    };
    expect(exported.data.coins.length).toBeGreaterThan(0);
    expect(exported.data.redemptions.length).toBeGreaterThan(0);
    const imported = await call('POST', 'backup/import', { confirm: true, backup: exported }, { auth: true });
    expect(imported.status).toBe(200);
    const after = await overview();
    expect(after.coins).toEqual(before.coins);
    expect(after.challengeBest).toBe(before.challengeBest);

    // Gian lận: đổi quà nhiều hơn số xu kiếm được
    const cheat = structuredClone(exported);
    cheat.data.coins = [];
    expect((await call('POST', 'backup/import', { confirm: true, backup: cheat }, { auth: true })).status).toBe(422);

    // File cũ (phiên bản 1) chưa có các mục mới
    const v1 = structuredClone(exported) as { schemaVersion: number; data: Record<string, unknown> };
    v1.schemaVersion = 1;
    for (const k of ['coins', 'shopRewards', 'redemptions', 'challenges']) delete v1.data[k];
    expect((await call('POST', 'backup/import', { confirm: true, backup: v1 }, { auth: true })).status).toBe(200);
    expect((await overview()).coins).toEqual({ earned: 0, spent: 0, balance: 0 });
  });
});
