/**
 * API client cho frontend. Không chứa bất kỳ thông tin kết nối database nào –
 * chỉ gọi REST API cùng domain (/api/...).
 */
import type { AgeGroup, Question, RewardGrant } from '../engine/types';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const FAMILY_REQUIRED_EVENT = 'bvht:family-required';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-BVHT-Client': '1' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, 'network', 'Không kết nối được máy chủ');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // phản hồi rỗng / không phải JSON
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    // Máy chưa đăng nhập gia đình (hoặc mã vừa bị đổi) => báo cho FamilyGate hiện màn hình đăng nhập.
    if (res.status === 401 && err?.code === 'family_required') window.dispatchEvent(new Event(FAMILY_REQUIRED_EVENT));
    throw new ApiClientError(res.status, err?.code ?? 'error', err?.message ?? 'Có lỗi xảy ra', err?.details);
  }
  return data as T;
}

// ---------- Kiểu dữ liệu phản hồi ----------
export interface PublicSettings {
  soundEnabled: boolean;
  reducedMotion: boolean;
  ageGroup: AgeGroup;
  pinConfigured: boolean;
  familyName: string;
}

export interface RegistrationInfo {
  open: boolean;
  inviteRequired: boolean;
  full: boolean;
}

export interface FamilyStatus {
  loggedIn: boolean;
  family?: { name: string; hasCode: boolean };
  registration: RegistrationInfo;
}

export interface StickerCount {
  code: string;
  quantity: number;
  firstEarnedAt: string;
}

export interface ChapterSummary {
  chapterId: string;
  totalSessions: number;
  perfectSessions: number;
  bestScore: number;
  totalCorrect: number;
  totalIncorrect: number;
  learnedAt: string | null;
  lastPlayedAt: string | null;
  completedAt: string | null;
  stars: number;
}

export interface Summary {
  totals: {
    totalCandies: number;
    totalCompletedQuizzes: number;
    totalCorrectAnswers: number;
    totalIncorrectAnswers: number;
    giftsOpened: number;
    giftsAvailable: number;
    candiesUntilNextGift: number;
  };
  chapters: ChapterSummary[];
  stickers: StickerCount[];
  overallProgress: number;
  settings: PublicSettings;
}

export interface StartedSession {
  sessionId: string;
  chapterId: string;
  startedAt: string;
  questions: Question[];
}

export interface CompletedSession {
  sessionId: string;
  chapterId: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  score: number;
  percent: number;
  isPerfectScore: boolean;
  completedAt: string;
  encouragement: string;
  candiesEarned: number;
  /** Xu kiếm được (nhóm 5–9 tuổi). */
  coinsEarned?: number;
  rewards: RewardGrant[];
  alreadyCompleted: boolean;
  totals: { totalCandies: number; giftsAvailable: number };
  saved: true;
}

export interface RewardsOverview {
  totalCandies: number;
  giftsOpened: number;
  giftsAvailable: number;
  candiesUntilNextGift: number;
  stickers: StickerCount[];
  recent: { rewardType: string; rewardCode: string; quantity: number; earnedAt: string }[];
}

export interface GiftResult {
  giftId: string;
  stickerCode: string;
  isNewSticker: boolean;
  alreadyOpened: boolean;
  giftsAvailable: number;
}

export interface HistoryItem {
  id: string;
  chapterId: string;
  chapterName: string;
  startedAt: string;
  completedAt: string | null;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  score: number;
  isPerfectScore: boolean;
  candiesEarned: number;
}

export interface HistoryPage {
  items: HistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SessionDetail extends Omit<HistoryItem, 'completedAt'> {
  completedAt: string | null;
  answers: {
    questionIndex: number;
    prompt: string;
    questionType: string;
    correctAnswer: number;
    selectedAnswer: number;
    attemptHistory: number[];
    /** Tên hình khi câu trả lời là hình (null nếu là số). */
    correctLabel: string | null;
    selectedLabel: string | null;
    isCorrect: boolean;
    attempts: number;
  }[];
}

export interface ParentStats {
  totals: {
    totalCandies: number;
    totalCompletedQuizzes: number;
    totalCorrectAnswers: number;
    totalIncorrectAnswers: number;
    accuracy: number;
    giftsOpened: number;
    stickersUnlocked: number;
  };
  chapters: (ChapterSummary & { name: string; accuracy: number })[];
}

// ---------- Nhóm 5–9 tuổi ----------
export interface CoinBalance {
  earned: number;
  spent: number;
  balance: number;
}

export interface PrimaryOverview {
  coins: CoinBalance;
  reviewCount: number;
  challengeBest: number;
  weekRank: number;
  weekCoins: number;
  families: number;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  coins: number;
  me: boolean;
}

export interface Leaderboard {
  weekStart: string;
  weekEnd: string;
  week: LeaderboardRow[];
  allTime: LeaderboardRow[];
}

export interface ShopView {
  coins: CoinBalance;
  rewards: { id: string; name: string; cost: number }[];
  redemptions: { id: string; name: string; cost: number; redeemedAt: string; deliveredAt: string | null }[];
}

export interface StartedChallenge {
  runId: string;
  durationMs: number;
  questions: { id: string; text: string; answer: number }[];
  best: number;
}

export interface ChallengeResult {
  runId: string;
  correct: number;
  wrong: number;
  coinsEarned: number;
  best: number;
  isRecord: boolean;
  alreadyCompleted: boolean;
}

// ---------- Endpoints ----------
export const api = {
  summary: () => request<Summary>('GET', 'summary'),
  settings: () => request<PublicSettings>('GET', 'settings'),
  updateSettings: (patch: Partial<Pick<PublicSettings, 'soundEnabled' | 'reducedMotion' | 'ageGroup'>>) =>
    request<PublicSettings>('PUT', 'settings', patch),

  startQuiz: (chapterId: string) => request<StartedSession>('POST', 'quiz/sessions', { chapterId }),
  completeQuiz: (sessionId: string, body: { answers: { questionId: string; attempts: number[] }[]; clientDurationMs?: number }) =>
    request<CompletedSession>('POST', `quiz/sessions/${encodeURIComponent(sessionId)}/complete`, body),
  completeLearning: (chapterId: string) => request<{ ok: true }>('POST', 'learning/complete', { chapterId }),

  rewards: () => request<RewardsOverview>('GET', 'rewards'),
  openGift: (giftId: string) => request<GiftResult>('POST', 'rewards/gifts/open', { giftId }),

  familyStatus: () => request<FamilyStatus>('GET', 'family/status'),
  familyLogin: (body: { name: string; code?: string; pin?: string }) => request<{ loggedIn: true }>('POST', 'family/login', body),
  familyRegister: (body: { name: string; code: string; pin: string; invite?: string }) =>
    request<{ loggedIn: true }>('POST', 'family/register', body),
  familyLogout: () => request<{ loggedIn: false }>('POST', 'family/logout'),
  setFamilyCode: (code: string) => request<{ ok: true }>('PUT', 'family/code', { code }),
  renameFamily: (name: string) => request<{ name: string }>('PUT', 'family/name', { name }),
  familyLogoutAll: () => request<{ ok: true }>('POST', 'family/logout-all'),

  parentSession: () => request<{ pinConfigured: boolean; authenticated: boolean }>('GET', 'parent/session'),
  parentSetup: (pin: string) => request<{ authenticated: true }>('POST', 'parent/setup', { pin }),
  parentLogin: (pin: string) => request<{ authenticated: true }>('POST', 'parent/login', { pin }),
  parentLogout: () => request<{ authenticated: false }>('POST', 'parent/logout'),
  changePin: (currentPin: string, newPin: string) => request<{ ok: true }>('POST', 'parent/change-pin', { currentPin, newPin }),
  parentStats: () => request<ParentStats>('GET', 'parent/stats'),
  history: (page: number, pageSize = 10, chapterId?: string) =>
    request<HistoryPage>(
      'GET',
      `history?page=${page}&pageSize=${pageSize}${chapterId ? `&chapterId=${encodeURIComponent(chapterId)}` : ''}`,
    ),
  historyDetail: (id: string) => request<SessionDetail>('GET', `history/${encodeURIComponent(id)}`),

  primaryOverview: () => request<PrimaryOverview>('GET', 'primary/overview'),
  leaderboard: () => request<Leaderboard>('GET', 'leaderboard'),
  startChallenge: () => request<StartedChallenge>('POST', 'challenge'),
  completeChallenge: (runId: string, answers: { questionId: string; value: number }[]) =>
    request<ChallengeResult>('POST', `challenge/${encodeURIComponent(runId)}/complete`, { answers }),
  shop: () => request<ShopView>('GET', 'shop'),
  redeem: (rewardId: string, redemptionId: string) => request<ShopView>('POST', 'shop/redeem', { rewardId, redemptionId }),
  addShopReward: (name: string, cost: number) => request<ShopView>('POST', 'shop/rewards', { name, cost }),
  removeShopReward: (id: string) => request<ShopView>('POST', `shop/rewards/${encodeURIComponent(id)}/remove`),
  markDelivered: (id: string) => request<ShopView>('POST', `shop/redemptions/${encodeURIComponent(id)}/deliver`),

  exportBackup: () => request<Record<string, unknown>>('GET', 'backup/export'),
  importBackup: (backup: unknown) =>
    request<{ ok: true; imported: { sessions: number; rewards: number } }>('POST', 'backup/import', { confirm: true, backup }),
  resetAll: () => request<{ ok: true }>('POST', 'backup/reset', { confirm: 'XOA' }),
};
