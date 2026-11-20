/**
 * Database schema – Bé Vui Học Toán.
 *
 * Nguyên tắc:
 *  - Mọi phần thưởng đều nằm trong bảng `rewards`, có `dedupe_key` UNIQUE
 *    để một phần thưởng không bao giờ bị cộng hai lần (kể cả khi API bị gọi lặp).
 *  - Nhiều gia đình dùng chung một hệ thống: mọi dữ liệu học tập gắn `family_id`
 *    (bảng `families` giữ tên, mã gia đình, PIN phụ huynh, cài đặt của từng nhà).
 *  - `progress` có đúng 1 dòng mỗi gia đình; `app_settings` chỉ còn khoá bí mật chung (id = 1).
 *  - Câu hỏi của mỗi phiên được server sinh và lưu lại (`quiz_sessions.questions`),
 *    nên server tự chấm điểm, không tin điểm số từ frontend.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/** Câu hỏi đã sinh, lưu dạng JSON trong phiên (snapshot để chấm điểm phía server). */
export interface StoredQuestion {
  id: string;
  type: string;
  prompt: string;
  payload: Record<string, unknown>;
  correctAnswer: number;
  options: number[];
  input?: boolean;
}

/** Mỗi gia đình một dòng: đăng nhập (tên + mã gia đình), PIN phụ huynh, cài đặt. */
export const families = pgTable(
  'families',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tên hiển thị, ví dụ "Nhà Tuệ Anh". */
    name: text('name').notNull(),
    /** Tên chuẩn hoá (bỏ dấu, chữ thường) dùng để đăng nhập – không trùng. */
    nameKey: text('name_key').notNull(),
    /** Mã gia đình (scrypt) để vào ứng dụng trên máy mới. */
    codeHash: text('code_hash'),
    /** Tăng khi đổi mã / "đăng xuất mọi máy" => các máy đã nhớ phải đăng nhập lại. */
    familyVersion: integer('family_version').notNull().default(1),
    failedCodeAttempts: integer('failed_code_attempts').notNull().default(0),
    codeLockedUntil: timestamp('code_locked_until', { withTimezone: true }),
    /** scrypt$<salt>$<hash> – không bao giờ lưu PIN dạng văn bản. */
    pinHash: text('pin_hash'),
    /** Tăng khi đổi PIN / đăng xuất toàn bộ => vô hiệu hoá các phiên phụ huynh cũ. */
    sessionVersion: integer('session_version').notNull().default(1),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
    soundEnabled: boolean('sound_enabled').notNull().default(true),
    reducedMotion: boolean('reduced_motion').notNull().default(false),
    /** Nhóm tuổi đang chọn ở trang chủ: 'preschool' (3–5 tuổi) | 'primary' (5–9 tuổi). */
    ageGroup: text('age_group').notNull().default('preschool'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('families_name_key_uq').on(t.nameKey)],
);

const familyRef = () =>
  uuid('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' });

/** Tiến độ tổng thể (1 dòng mỗi gia đình). */
export const progress = pgTable(
  'progress',
  {
    familyId: uuid('family_id')
      .primaryKey()
      .references(() => families.id, { onDelete: 'cascade' }),
    totalCandies: integer('total_candies').notNull().default(0),
    totalCompletedQuizzes: integer('total_completed_quizzes').notNull().default(0),
    totalCorrectAnswers: integer('total_correct_answers').notNull().default(0),
    totalIncorrectAnswers: integer('total_incorrect_answers').notNull().default(0),
    giftsOpened: integer('gifts_opened').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('progress_non_negative', sql`${t.totalCandies} >= 0 AND ${t.giftsOpened} >= 0`),
  ],
);

/** Lịch sử từng bài kiểm tra. */
export const quizSessions = pgTable(
  'quiz_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: familyRef(),
    chapterId: text('chapter_id').notNull(),
    chapterName: text('chapter_name').notNull(),
    /** in_progress | completed */
    status: text('status').notNull().default('in_progress'),
    questions: jsonb('questions').$type<StoredQuestion[]>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    totalQuestions: integer('total_questions').notNull(),
    correctAnswers: integer('correct_answers').notNull().default(0),
    incorrectAnswers: integer('incorrect_answers').notNull().default(0),
    /** Điểm thang 10 (làm tròn). */
    score: integer('score').notNull().default(0),
    isPerfectScore: boolean('is_perfect_score').notNull().default(false),
    candiesEarned: integer('candies_earned').notNull().default(0),
  },
  (t) => [
    index('quiz_sessions_family_chapter_idx').on(t.familyId, t.chapterId),
    index('quiz_sessions_family_status_started_idx').on(t.familyId, t.status, t.startedAt),
    index('quiz_sessions_family_completed_idx').on(t.familyId, t.completedAt),
    index('quiz_sessions_status_started_idx').on(t.status, t.startedAt),
    check('quiz_sessions_status_check', sql`${t.status} IN ('in_progress', 'completed')`),
  ],
);

/** Chi tiết từng câu trả lời. */
export const quizAnswers = pgTable(
  'quiz_answers',
  {
    id: serial('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => quizSessions.id, { onDelete: 'cascade' }),
    questionIndex: integer('question_index').notNull(),
    questionId: text('question_id').notNull(),
    questionType: text('question_type').notNull(),
    correctAnswer: integer('correct_answer').notNull(),
    /** Đáp án của lần chọn ĐẦU TIÊN (dùng để chấm điểm). */
    selectedAnswer: integer('selected_answer').notNull(),
    /** Toàn bộ các lần chọn theo thứ tự. */
    attemptHistory: jsonb('attempt_history').$type<number[]>().notNull(),
    isCorrect: boolean('is_correct').notNull(),
    attempts: integer('attempts').notNull(),
  },
  (t) => [
    index('quiz_answers_session_idx').on(t.sessionId),
    uniqueIndex('quiz_answers_session_question_uq').on(t.sessionId, t.questionIndex),
  ],
);

/** Lượt mở hộp quà. `id` do client sinh (UUID) => gọi lặp không mở thêm hộp. */
export const giftOpenings = pgTable('gift_openings', {
  id: uuid('id').primaryKey(),
  familyId: familyRef(),
  stickerCode: text('sticker_code').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Mọi phần thưởng (kẹo, sticker). */
export const rewards = pgTable(
  'rewards',
  {
    id: serial('id').primaryKey(),
    familyId: familyRef(),
    /** candy | sticker */
    rewardType: text('reward_type').notNull(),
    rewardCode: text('reward_code').notNull(),
    quantity: integer('quantity').notNull().default(1),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
    sourceSessionId: uuid('source_session_id').references(() => quizSessions.id, {
      onDelete: 'set null',
    }),
    sourceGiftId: uuid('source_gift_id').references(() => giftOpenings.id, {
      onDelete: 'set null',
    }),
    /** Khoá chống cộng trùng, ví dụ `session:<id>:candy`, `achievement:first-quiz`. */
    dedupeKey: text('dedupe_key').notNull(),
  },
  (t) => [
    uniqueIndex('rewards_family_dedupe_key_uq').on(t.familyId, t.dedupeKey),
    index('rewards_family_type_code_idx').on(t.familyId, t.rewardType, t.rewardCode),
    index('rewards_source_session_idx').on(t.sourceSessionId),
    check('rewards_type_check', sql`${t.rewardType} IN ('candy', 'sticker')`),
    check('rewards_quantity_check', sql`${t.quantity} > 0`),
  ],
);

/** Tiến độ theo từng chương. */
export const chapterProgress = pgTable(
  'chapter_progress',
  {
    id: serial('id').primaryKey(),
    familyId: familyRef(),
    chapterId: text('chapter_id').notNull(),
    totalSessions: integer('total_sessions').notNull().default(0),
    perfectSessions: integer('perfect_sessions').notNull().default(0),
    bestScore: integer('best_score').notNull().default(0),
    totalCorrect: integer('total_correct').notNull().default(0),
    totalIncorrect: integer('total_incorrect').notNull().default(0),
    /** Thời điểm bé xem hết thẻ học lần đầu. */
    learnedAt: timestamp('learned_at', { withTimezone: true }),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    /** Thời điểm hoàn thành bài kiểm tra đầu tiên của chương. */
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('chapter_progress_family_chapter_uq').on(t.familyId, t.chapterId)],
);

// ===================== Nhóm 5–9 tuổi =====================

/**
 * Sổ xu (chỉ ghi phần KIẾM được, luôn > 0). Xu còn lại = tổng sổ xu − tổng giá quà đã đổi.
 * `dedupe_key` chống cộng trùng: `session:<id>:coin`, `challenge:<id>:coin`.
 */
export const coinLedger = pgTable(
  'coin_ledger',
  {
    id: serial('id').primaryKey(),
    familyId: familyRef(),
    amount: integer('amount').notNull(),
    /** session | challenge */
    reason: text('reason').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('coin_ledger_family_dedupe_uq').on(t.familyId, t.dedupeKey),
    index('coin_ledger_earned_idx').on(t.earnedAt),
    check('coin_ledger_amount_check', sql`${t.amount} > 0`),
  ],
);

/** Quà thật do phụ huynh đặt (đổi bằng xu). Xoá = ẩn (active = false) để lịch sử đổi quà còn tên. */
export const shopRewards = pgTable(
  'shop_rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: familyRef(),
    name: text('name').notNull(),
    cost: integer('cost').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('shop_rewards_family_idx').on(t.familyId), check('shop_rewards_cost_check', sql`${t.cost} > 0`)],
);

/** Lượt đổi quà. `id` do client sinh (UUID) => bấm lặp không trừ xu hai lần. */
export const redemptions = pgTable(
  'redemptions',
  {
    id: uuid('id').primaryKey(),
    familyId: familyRef(),
    rewardId: uuid('reward_id').references(() => shopRewards.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    cost: integer('cost').notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
    /** Bố mẹ đã trao quà (null = chưa). */
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (t) => [index('redemptions_family_idx').on(t.familyId, t.redeemedAt), check('redemptions_cost_check', sql`${t.cost} > 0`)],
);

/** Câu bé làm sai lần đầu (nhóm 5–9 tuổi) – dùng cho "Ôn câu sai". `item_key` = `<chương>|<id câu>`. */
export const reviewItems = pgTable(
  'review_items',
  {
    id: serial('id').primaryKey(),
    familyId: familyRef(),
    itemKey: text('item_key').notNull(),
    chapterId: text('chapter_id').notNull(),
    question: jsonb('question').$type<StoredQuestion>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('review_items_family_key_uq').on(t.familyId, t.itemKey)],
);

/** Lượt "Thử thách 60 giây": server sinh đề & tự chấm. */
export const challengeRuns = pgTable(
  'challenge_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: familyRef(),
    questions: jsonb('questions').$type<{ id: string; text: string; answer: number }[]>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    correct: integer('correct').notNull().default(0),
    wrong: integer('wrong').notNull().default(0),
  },
  (t) => [index('challenge_runs_family_idx').on(t.familyId, t.completedAt)],
);

/** Cấu hình chung của hệ thống (1 dòng duy nhất): khoá bí mật ký cookie. */
export const appSettings = pgTable(
  'app_settings',
  {
    id: integer('id').primaryKey().default(1),
    sessionSecret: text('session_secret'),
    updatedAt: updatedAt(),
  },
  (t) => [check('app_settings_singleton', sql`${t.id} = 1`)],
);

export const schema = {
  families,
  progress,
  quizSessions,
  quizAnswers,
  giftOpenings,
  rewards,
  chapterProgress,
  coinLedger,
  shopRewards,
  redemptions,
  reviewItems,
  challengeRuns,
  appSettings,
};

export type ProgressRow = typeof progress.$inferSelect;
export type QuizSessionRow = typeof quizSessions.$inferSelect;
export type QuizAnswerRow = typeof quizAnswers.$inferSelect;
export type RewardRow = typeof rewards.$inferSelect;
export type GiftOpeningRow = typeof giftOpenings.$inferSelect;
export type ChapterProgressRow = typeof chapterProgress.$inferSelect;
export type ShopRewardRow = typeof shopRewards.$inferSelect;
export type RedemptionRow = typeof redemptions.$inferSelect;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type FamilyRow = typeof families.$inferSelect;
