/**
 * Bộ định tuyến REST API. Độc lập với nền tảng: nhận ApiRequest, trả ApiResponse.
 * - Vercel: api/router.ts chuyển đổi VercelRequest -> ApiRequest.
 * - Dev local: dev/apiPlugin.ts gắn router vào Vite dev server.
 * Gom tất cả endpoint vào 1 Function để nằm trong giới hạn số Function của gói miễn phí.
 */
import { sql } from 'drizzle-orm';
import { getEnabledChapters } from '../src/chapters/registry.js';
import {
  buildCookie,
  changePin,
  checkPinWithLockout,
  isTokenValid,
  issueToken,
  PARENT_COOKIE,
  parseCookies,
  requireParent,
  setupPin,
} from './auth.js';
import { getDb, type Database } from './db.js';
import { ApiError, badRequest, notFound } from './errors.js';
import { checkRateLimit, type RateLimitName } from './rateLimit.js';
import { exportBackup, importBackup, resetAllData } from './services/backupService.js';
import { getHistory, getParentStats, getSessionDetail } from './services/historyService.js';
import { getSummary, markLearned } from './services/progressService.js';
import { completeSession, startSession } from './services/quizService.js';
import { getRewardsOverview, openGift } from './services/rewardService.js';
import { bumpSessionVersion, getPublicSettings, updateSettings } from './services/settingsService.js';
import {
  changePinSchema,
  completeQuizSchema,
  historyQuerySchema,
  learningCompleteSchema,
  loginSchema,
  openGiftSchema,
  parseBody,
  resetSchema,
  settingsSchema,
  setupPinSchema,
  startQuizSchema,
  uuidSchema,
} from './validation.js';

export interface ApiRequest {
  method: string;
  /** Đường dẫn sau /api/, ví dụ "quiz/sessions". */
  path: string;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  body: unknown;
  ip: string;
  secure: boolean;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string | string[]>;
}

interface Context {
  req: ApiRequest;
  db: Database;
  params: string[];
  cookies: Record<string, string>;
}

interface Route {
  method: 'GET' | 'POST' | 'PUT';
  pattern: RegExp;
  parent?: boolean;
  limit?: RateLimitName;
  handler: (ctx: Context) => Promise<ApiResponse>;
}

const ok = (body: unknown, headers?: ApiResponse['headers']): ApiResponse => ({ status: 200, body, ...(headers ? { headers } : {}) });

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^health$/,
    handler: async ({ db }) => {
      await db.execute(sql`select 1`);
      return ok({ ok: true, database: 'connected', time: new Date().toISOString() });
    },
  },
  {
    method: 'GET',
    pattern: /^chapters$/,
    handler: async () =>
      ok({
        chapters: getEnabledChapters().map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          order: c.order,
          range: c.range,
          questionCount: c.quiz.questionCount,
          hasLearningStage: c.hasLearningStage,
        })),
      }),
  },
  { method: 'GET', pattern: /^summary$/, handler: async ({ db }) => ok(await getSummary(db)) },

  // ---------- Bài kiểm tra ----------
  {
    method: 'POST',
    pattern: /^quiz\/sessions$/,
    limit: 'write',
    handler: async ({ db, req }) => {
      const { chapterId } = parseBody(startQuizSchema, req.body);
      return ok(await startSession(db, chapterId));
    },
  },
  {
    method: 'POST',
    pattern: /^quiz\/sessions\/([^/]+)\/complete$/,
    limit: 'write',
    handler: async ({ db, req, params }) => {
      const sessionId = parseUuid(params[0]);
      const { answers } = parseBody(completeQuizSchema, req.body);
      return ok(await completeSession(db, sessionId, answers));
    },
  },
  {
    method: 'POST',
    pattern: /^learning\/complete$/,
    limit: 'write',
    handler: async ({ db, req }) => {
      const { chapterId } = parseBody(learningCompleteSchema, req.body);
      if (!getEnabledChapters().some((c) => c.id === chapterId)) throw notFound('Không tìm thấy chương học');
      await markLearned(db, chapterId);
      return ok({ ok: true });
    },
  },

  // ---------- Phần thưởng ----------
  { method: 'GET', pattern: /^rewards$/, handler: async ({ db }) => ok(await getRewardsOverview(db)) },
  {
    method: 'POST',
    pattern: /^rewards\/gifts\/open$/,
    limit: 'write',
    handler: async ({ db, req }) => {
      const { giftId } = parseBody(openGiftSchema, req.body);
      return ok(await openGift(db, giftId));
    },
  },

  // ---------- Cài đặt ----------
  { method: 'GET', pattern: /^settings$/, handler: async ({ db }) => ok(await getPublicSettings(db)) },
  {
    method: 'PUT',
    pattern: /^settings$/,
    limit: 'write',
    handler: async ({ db, req }) => ok(await updateSettings(db, parseBody(settingsSchema, req.body))),
  },

  // ---------- Phụ huynh ----------
  {
    method: 'GET',
    pattern: /^parent\/session$/,
    handler: async ({ db, cookies }) => {
      const settings = await getPublicSettings(db);
      return ok({
        pinConfigured: settings.pinConfigured,
        authenticated: await isTokenValid(db, cookies[PARENT_COOKIE]),
      });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/setup$/,
    limit: 'auth',
    handler: async ({ db, req }) => {
      const { pin } = parseBody(setupPinSchema, req.body);
      await setupPin(db, pin);
      const token = await issueToken(db);
      return ok({ authenticated: true }, { 'Set-Cookie': buildCookie(token, req.secure) });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/login$/,
    limit: 'auth',
    handler: async ({ db, req }) => {
      const { pin } = parseBody(loginSchema, req.body);
      await checkPinWithLockout(db, pin);
      const token = await issueToken(db);
      return ok({ authenticated: true }, { 'Set-Cookie': buildCookie(token, req.secure) });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/logout$/,
    handler: async ({ req }) => ok({ authenticated: false }, { 'Set-Cookie': buildCookie(null, req.secure) }),
  },
  {
    method: 'POST',
    pattern: /^parent\/logout-all$/,
    parent: true,
    handler: async ({ db, req }) => {
      await bumpSessionVersion(db);
      return ok({ authenticated: false }, { 'Set-Cookie': buildCookie(null, req.secure) });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/change-pin$/,
    parent: true,
    limit: 'auth',
    handler: async ({ db, req }) => {
      const { currentPin, newPin } = parseBody(changePinSchema, req.body);
      await changePin(db, currentPin, newPin);
      const token = await issueToken(db);
      return ok({ ok: true }, { 'Set-Cookie': buildCookie(token, req.secure) });
    },
  },
  { method: 'GET', pattern: /^parent\/stats$/, parent: true, handler: async ({ db }) => ok(await getParentStats(db)) },
  {
    method: 'GET',
    pattern: /^history$/,
    parent: true,
    handler: async ({ db, req }) => ok(await getHistory(db, parseBody(historyQuerySchema, req.query))),
  },
  {
    method: 'GET',
    pattern: /^history\/([^/]+)$/,
    parent: true,
    handler: async ({ db, params }) => ok(await getSessionDetail(db, parseUuid(params[0]))),
  },

  // ---------- Sao lưu ----------
  {
    method: 'GET',
    pattern: /^backup\/export$/,
    parent: true,
    limit: 'heavy',
    handler: async ({ db }) => {
      const backup = await exportBackup(db);
      const date = backup.exportedAt.slice(0, 10);
      return ok(backup, { 'Content-Disposition': `attachment; filename="be-vui-hoc-toan-${date}.json"` });
    },
  },
  {
    method: 'POST',
    pattern: /^backup\/import$/,
    parent: true,
    limit: 'heavy',
    handler: async ({ db, req }) => {
      const body = req.body as { confirm?: unknown; backup?: unknown } | null;
      if (!body || body.confirm !== true) throw badRequest('Cần xác nhận trước khi ghi đè dữ liệu');
      return ok({ ok: true, imported: await importBackup(db, body.backup) });
    },
  },
  {
    method: 'POST',
    pattern: /^backup\/reset$/,
    parent: true,
    limit: 'heavy',
    handler: async ({ db, req }) => {
      parseBody(resetSchema, req.body);
      await resetAllData(db);
      return ok({ ok: true });
    },
  },
];

function parseUuid(value: string | undefined): string {
  const r = uuidSchema.safeParse(value);
  if (!r.success) throw notFound('Không tìm thấy');
  return r.data;
}

/** Header bắt buộc cho request thay đổi dữ liệu – chặn CSRF từ trang khác. */
export const CSRF_HEADER = 'x-bvht-client';

export async function handleApiRequest(req: ApiRequest, db?: Database): Promise<ApiResponse> {
  try {
    const path = req.path.replace(/^\/+|\/+$/g, '');
    const candidates = routes.filter((r) => r.pattern.test(path));
    if (candidates.length === 0) throw notFound('API không tồn tại');
    const route = candidates.find((r) => r.method === req.method);
    if (!route) throw new ApiError(405, 'method_not_allowed', 'Phương thức không được hỗ trợ');

    checkRateLimit('default', req.ip);
    if (route.limit) checkRateLimit(route.limit, req.ip);

    if (route.method !== 'GET' && req.headers[CSRF_HEADER] !== '1') {
      throw new ApiError(403, 'forbidden', 'Yêu cầu không hợp lệ');
    }

    const database = db ?? getDb();
    const cookies = parseCookies(req.headers.cookie);
    if (route.parent) await requireParent(database, cookies[PARENT_COOKIE]);

    const params = route.pattern.exec(path)?.slice(1) ?? [];
    return await route.handler({ req, db: database, params, cookies });
  } catch (err) {
    if (err instanceof ApiError) {
      return { status: err.status, body: { error: { code: err.code, message: err.message, details: err.details } } };
    }
    console.error('[api] lỗi không mong muốn:', err);
    const message =
      err instanceof Error && /DATABASE_URL/.test(err.message)
        ? 'Máy chủ chưa được cấu hình cơ sở dữ liệu'
        : 'Có lỗi xảy ra, vui lòng thử lại sau';
    return { status: 500, body: { error: { code: 'internal_error', message } } };
  }
}
