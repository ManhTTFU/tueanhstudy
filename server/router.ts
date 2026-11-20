/**
 * Bộ định tuyến REST API. Độc lập với nền tảng: nhận ApiRequest, trả ApiResponse.
 * - Vercel: api/router.ts chuyển đổi VercelRequest -> ApiRequest.
 * - Dev local: dev/apiPlugin.ts gắn router vào Vite dev server.
 * Gom tất cả endpoint vào 1 Function để nằm trong giới hạn số Function của gói miễn phí.
 *
 * Nhiều gia đình: mọi API (trừ các API `open`) cần cookie gia đình hợp lệ; dữ liệu
 * luôn được đọc/ghi theo `familyId` lấy từ cookie, KHÔNG BAO GIỜ từ dữ liệu client gửi lên.
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
import {
  buildFamilyCookie,
  bumpFamilyVersion,
  FAMILY_COOKIE,
  familyFromToken,
  familyRequired,
  getRegistrationInfo,
  issueFamilyToken,
  loginFamily,
  registerFamily,
  renameFamily,
  setFamilyCode,
} from './familyAuth.js';
import { checkRateLimit, type RateLimitName } from './rateLimit.js';
import { exportBackup, importBackup, resetAllData } from './services/backupService.js';
import { getHistory, getParentStats, getSessionDetail } from './services/historyService.js';
import { completeChallenge, startChallenge } from './services/challengeService.js';
import {
  addShopReward,
  getLeaderboard,
  getPrimaryOverview,
  getShop,
  markDelivered,
  redeemReward,
  removeShopReward,
} from './services/primaryService.js';
import { getSummary, markLearned } from './services/progressService.js';
import { completeSession, startSession } from './services/quizService.js';
import { getRewardsOverview, openGift } from './services/rewardService.js';
import { bumpSessionVersion, getFamilyRow, getPublicSettings, updateSettings } from './services/settingsService.js';
import {
  challengeCompleteSchema,
  changePinSchema,
  completeQuizSchema,
  familyLoginSchema,
  familyRegisterSchema,
  historyQuerySchema,
  learningCompleteSchema,
  loginSchema,
  openGiftSchema,
  parseBody,
  redeemSchema,
  renameFamilySchema,
  resetSchema,
  setFamilyCodeSchema,
  settingsSchema,
  setupPinSchema,
  shopRewardSchema,
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

interface OpenContext {
  req: ApiRequest;
  db: Database;
  params: string[];
  cookies: Record<string, string>;
  /** Gia đình đang đăng nhập trên máy (null nếu chưa). */
  familyId: string | null;
}

interface Context extends OpenContext {
  familyId: string;
}

type Route =
  | {
      method: 'GET' | 'POST' | 'PUT';
      pattern: RegExp;
      /** Không cần đăng nhập gia đình. */
      open: true;
      limit?: RateLimitName;
      handler: (ctx: OpenContext) => Promise<ApiResponse>;
    }
  | {
      method: 'GET' | 'POST' | 'PUT';
      pattern: RegExp;
      open?: false;
      /** Cần phụ huynh của gia đình đã đăng nhập bằng PIN. */
      parent?: boolean;
      limit?: RateLimitName;
      handler: (ctx: Context) => Promise<ApiResponse>;
    };

const ok = (body: unknown, headers?: ApiResponse['headers']): ApiResponse => ({ status: 200, body, ...(headers ? { headers } : {}) });

/** Đăng nhập gia đình => cookie gia đình (và xoá phiên phụ huynh của gia đình cũ trên máy). */
async function familyLoginCookies(db: Database, familyId: string, secure: boolean): Promise<string[]> {
  return [buildFamilyCookie(await issueFamilyToken(db, familyId), secure), buildCookie(null, secure)];
}

/** Phụ huynh đăng nhập (PIN) => nhận cả cookie phụ huynh lẫn cookie gia đình. */
async function parentLoginCookies(db: Database, familyId: string, secure: boolean): Promise<string[]> {
  return [buildCookie(await issueToken(db, familyId), secure), buildFamilyCookie(await issueFamilyToken(db, familyId), secure)];
}

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^health$/,
    open: true,
    handler: async ({ db }) => {
      await db.execute(sql`select 1`);
      return ok({ ok: true, database: 'connected', time: new Date().toISOString() });
    },
  },
  {
    method: 'GET',
    pattern: /^chapters$/,
    open: true,
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

  // ---------- Gia đình ----------
  {
    method: 'GET',
    pattern: /^family\/status$/,
    open: true,
    handler: async ({ db, familyId }) => {
      const registration = await getRegistrationInfo(db);
      if (!familyId) return ok({ loggedIn: false, registration });
      const family = await getFamilyRow(db, familyId);
      return ok({ loggedIn: true, family: { name: family.name, hasCode: family.codeHash !== null }, registration });
    },
  },
  {
    method: 'POST',
    pattern: /^family\/login$/,
    open: true,
    limit: 'auth',
    handler: async ({ db, req }) => {
      const body = parseBody(familyLoginSchema, req.body);
      const familyId = await loginFamily(db, body);
      // Đăng nhập bằng PIN => vào luôn khu phụ huynh.
      const cookies = body.pin
        ? await parentLoginCookies(db, familyId, req.secure)
        : await familyLoginCookies(db, familyId, req.secure);
      return ok({ loggedIn: true }, { 'Set-Cookie': cookies });
    },
  },
  {
    method: 'POST',
    pattern: /^family\/register$/,
    open: true,
    limit: 'auth',
    handler: async ({ db, req }) => {
      const body = parseBody(familyRegisterSchema, req.body);
      const familyId = await registerFamily(db, body);
      const cookies = body.pin
        ? await parentLoginCookies(db, familyId, req.secure)
        : await familyLoginCookies(db, familyId, req.secure);
      return ok({ loggedIn: true }, { 'Set-Cookie': cookies });
    },
  },
  {
    method: 'POST',
    pattern: /^family\/logout$/,
    open: true,
    handler: async ({ req }) =>
      ok({ loggedIn: false }, { 'Set-Cookie': [buildFamilyCookie(null, req.secure), buildCookie(null, req.secure)] }),
  },
  {
    method: 'PUT',
    pattern: /^family\/code$/,
    parent: true,
    limit: 'auth',
    handler: async ({ db, req, familyId }) => {
      const { code } = parseBody(setFamilyCodeSchema, req.body);
      await setFamilyCode(db, familyId, code);
      // Máy đang thao tác vẫn giữ quyền vào; các máy khác phải đăng nhập lại bằng mã mới.
      return ok({ ok: true }, { 'Set-Cookie': buildFamilyCookie(await issueFamilyToken(db, familyId), req.secure) });
    },
  },
  {
    method: 'PUT',
    pattern: /^family\/name$/,
    parent: true,
    limit: 'auth',
    handler: async ({ db, req, familyId }) => {
      const { name } = parseBody(renameFamilySchema, req.body);
      return ok({ name: await renameFamily(db, familyId, name) });
    },
  },
  {
    method: 'POST',
    pattern: /^family\/logout-all$/,
    parent: true,
    handler: async ({ db, req, familyId }) => {
      await bumpFamilyVersion(db, familyId);
      return ok({ ok: true }, { 'Set-Cookie': buildFamilyCookie(await issueFamilyToken(db, familyId), req.secure) });
    },
  },

  { method: 'GET', pattern: /^summary$/, handler: async ({ db, familyId }) => ok(await getSummary(db, familyId)) },

  // ---------- Bài kiểm tra ----------
  {
    method: 'POST',
    pattern: /^quiz\/sessions$/,
    limit: 'write',
    handler: async ({ db, req, familyId }) => {
      const { chapterId } = parseBody(startQuizSchema, req.body);
      return ok(await startSession(db, familyId, chapterId));
    },
  },
  {
    method: 'POST',
    pattern: /^quiz\/sessions\/([^/]+)\/complete$/,
    limit: 'write',
    handler: async ({ db, req, params, familyId }) => {
      const sessionId = parseUuid(params[0]);
      const { answers } = parseBody(completeQuizSchema, req.body);
      return ok(await completeSession(db, familyId, sessionId, answers));
    },
  },
  {
    method: 'POST',
    pattern: /^learning\/complete$/,
    limit: 'write',
    handler: async ({ db, req, familyId }) => {
      const { chapterId } = parseBody(learningCompleteSchema, req.body);
      if (!getEnabledChapters().some((c) => c.id === chapterId)) throw notFound('Không tìm thấy chương học');
      await markLearned(db, familyId, chapterId);
      return ok({ ok: true });
    },
  },

  // ---------- Phần thưởng ----------
  { method: 'GET', pattern: /^rewards$/, handler: async ({ db, familyId }) => ok(await getRewardsOverview(db, familyId)) },
  {
    method: 'POST',
    pattern: /^rewards\/gifts\/open$/,
    limit: 'write',
    handler: async ({ db, req, familyId }) => {
      const { giftId } = parseBody(openGiftSchema, req.body);
      return ok(await openGift(db, familyId, giftId));
    },
  },

  // ---------- Nhóm 5–9 tuổi: xu, thử thách, đổi quà, bảng xếp hạng ----------
  { method: 'GET', pattern: /^primary\/overview$/, handler: async ({ db, familyId }) => ok(await getPrimaryOverview(db, familyId)) },
  { method: 'GET', pattern: /^leaderboard$/, handler: async ({ db, familyId }) => ok(await getLeaderboard(db, familyId)) },
  {
    method: 'POST',
    pattern: /^challenge$/,
    limit: 'write',
    handler: async ({ db, familyId }) => ok(await startChallenge(db, familyId)),
  },
  {
    method: 'POST',
    pattern: /^challenge\/([^/]+)\/complete$/,
    limit: 'write',
    handler: async ({ db, req, params, familyId }) => {
      const runId = parseUuid(params[0]);
      const { answers } = parseBody(challengeCompleteSchema, req.body);
      return ok(await completeChallenge(db, familyId, runId, answers));
    },
  },
  { method: 'GET', pattern: /^shop$/, handler: async ({ db, familyId }) => ok(await getShop(db, familyId)) },
  {
    method: 'POST',
    pattern: /^shop\/redeem$/,
    limit: 'write',
    handler: async ({ db, req, familyId }) => ok(await redeemReward(db, familyId, parseBody(redeemSchema, req.body))),
  },
  {
    method: 'POST',
    pattern: /^shop\/rewards$/,
    parent: true,
    limit: 'write',
    handler: async ({ db, req, familyId }) => ok(await addShopReward(db, familyId, parseBody(shopRewardSchema, req.body))),
  },
  {
    method: 'POST',
    pattern: /^shop\/rewards\/([^/]+)\/remove$/,
    parent: true,
    limit: 'write',
    handler: async ({ db, params, familyId }) => ok(await removeShopReward(db, familyId, parseUuid(params[0]))),
  },
  {
    method: 'POST',
    pattern: /^shop\/redemptions\/([^/]+)\/deliver$/,
    parent: true,
    limit: 'write',
    handler: async ({ db, params, familyId }) => ok(await markDelivered(db, familyId, parseUuid(params[0]))),
  },

  // ---------- Cài đặt ----------
  { method: 'GET', pattern: /^settings$/, handler: async ({ db, familyId }) => ok(await getPublicSettings(db, familyId)) },
  {
    method: 'PUT',
    pattern: /^settings$/,
    limit: 'write',
    handler: async ({ db, req, familyId }) => ok(await updateSettings(db, familyId, parseBody(settingsSchema, req.body))),
  },

  // ---------- Phụ huynh ----------
  {
    method: 'GET',
    pattern: /^parent\/session$/,
    handler: async ({ db, cookies, familyId }) => {
      const settings = await getPublicSettings(db, familyId);
      return ok({
        pinConfigured: settings.pinConfigured,
        authenticated: await isTokenValid(db, familyId, cookies[PARENT_COOKIE]),
      });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/setup$/,
    limit: 'auth',
    handler: async ({ db, req, familyId }) => {
      const { pin } = parseBody(setupPinSchema, req.body);
      await setupPin(db, familyId, pin);
      return ok({ authenticated: true }, { 'Set-Cookie': await parentLoginCookies(db, familyId, req.secure) });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/login$/,
    limit: 'auth',
    handler: async ({ db, req, familyId }) => {
      const { pin } = parseBody(loginSchema, req.body);
      await checkPinWithLockout(db, familyId, pin);
      return ok({ authenticated: true }, { 'Set-Cookie': await parentLoginCookies(db, familyId, req.secure) });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/logout$/,
    open: true,
    handler: async ({ req }) => ok({ authenticated: false }, { 'Set-Cookie': buildCookie(null, req.secure) }),
  },
  {
    method: 'POST',
    pattern: /^parent\/logout-all$/,
    parent: true,
    handler: async ({ db, req, familyId }) => {
      await bumpSessionVersion(db, familyId);
      return ok({ authenticated: false }, { 'Set-Cookie': buildCookie(null, req.secure) });
    },
  },
  {
    method: 'POST',
    pattern: /^parent\/change-pin$/,
    parent: true,
    limit: 'auth',
    handler: async ({ db, req, familyId }) => {
      const { currentPin, newPin } = parseBody(changePinSchema, req.body);
      await changePin(db, familyId, currentPin, newPin);
      return ok({ ok: true }, { 'Set-Cookie': buildCookie(await issueToken(db, familyId), req.secure) });
    },
  },
  {
    method: 'GET',
    pattern: /^parent\/stats$/,
    parent: true,
    handler: async ({ db, familyId }) => ok(await getParentStats(db, familyId)),
  },
  {
    method: 'GET',
    pattern: /^history$/,
    parent: true,
    handler: async ({ db, req, familyId }) => ok(await getHistory(db, familyId, parseBody(historyQuerySchema, req.query))),
  },
  {
    method: 'GET',
    pattern: /^history\/([^/]+)$/,
    parent: true,
    handler: async ({ db, params, familyId }) => ok(await getSessionDetail(db, familyId, parseUuid(params[0]))),
  },

  // ---------- Sao lưu ----------
  {
    method: 'GET',
    pattern: /^backup\/export$/,
    parent: true,
    limit: 'heavy',
    handler: async ({ db, familyId }) => {
      const backup = await exportBackup(db, familyId);
      const date = backup.exportedAt.slice(0, 10);
      return ok(backup, { 'Content-Disposition': `attachment; filename="be-vui-hoc-toan-${date}.json"` });
    },
  },
  {
    method: 'POST',
    pattern: /^backup\/import$/,
    parent: true,
    limit: 'heavy',
    handler: async ({ db, req, familyId }) => {
      const body = req.body as { confirm?: unknown; backup?: unknown } | null;
      if (!body || body.confirm !== true) throw badRequest('Cần xác nhận trước khi ghi đè dữ liệu');
      return ok({ ok: true, imported: await importBackup(db, familyId, body.backup) });
    },
  },
  {
    method: 'POST',
    pattern: /^backup\/reset$/,
    parent: true,
    limit: 'heavy',
    handler: async ({ db, req, familyId }) => {
      parseBody(resetSchema, req.body);
      await resetAllData(db, familyId);
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
    const params = route.pattern.exec(path)?.slice(1) ?? [];
    const familyId = await familyFromToken(database, cookies[FAMILY_COOKIE]);

    if (route.open) return await route.handler({ req, db: database, params, cookies, familyId });

    if (!familyId) throw familyRequired();
    if (route.parent) await requireParent(database, familyId, cookies[PARENT_COOKIE]);
    return await route.handler({ req, db: database, params, cookies, familyId });
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
