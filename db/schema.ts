/**
 * Database schema – Bé Vui Học Toán.
 *
 * Nguyên tắc:
 *  - Mọi phần thưởng đều nằm trong bảng `rewards`, có `dedupe_key` UNIQUE
 *    để một phần thưởng không bao giờ bị cộng hai lần (kể cả khi API bị gọi lặp).
 *  - Bảng `progress` và `app_settings` chỉ có đúng 1 dòng (id = 1).
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
}

/** Tiến độ tổng thể (1 dòng duy nhất). */
export const progress = pgTable(
  'progress',
  {
    id: integer('id').primaryKey().default(1),
    totalCandies: integer('total_candies').notNull().default(0),
    totalCompletedQuizzes: integer('total_completed_quizzes').notNull().default(0),
    totalCorrectAnswers: integer('total_correct_answers').notNull().default(0),
    totalIncorrectAnswers: integer('total_incorrect_answers').notNull().default(0),
    giftsOpened: integer('gifts_opened').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('progress_singleton', sql`${t.id} = 1`),
    check('progress_non_negative', sql`${t.totalCandies} >= 0 AND ${t.giftsOpened} >= 0`),
  ],
);

/** Lịch sử từng bài kiểm tra. */
export const quizSessions = pgTable(
  'quiz_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
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
    index('quiz_sessions_chapter_idx').on(t.chapterId),
    index('quiz_sessions_status_started_idx').on(t.status, t.startedAt),
    index('quiz_sessions_completed_idx').on(t.completedAt),
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
  stickerCode: text('sticker_code').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Mọi phần thưởng (kẹo, sticker). */
export const rewards = pgTable(
  'rewards',
  {
    id: serial('id').primaryKey(),
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
    uniqueIndex('rewards_dedupe_key_uq').on(t.dedupeKey),
    index('rewards_type_code_idx').on(t.rewardType, t.rewardCode),
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
  (t) => [uniqueIndex('chapter_progress_chapter_uq').on(t.chapterId)],
);

/** Cài đặt ứng dụng + bảo mật phụ huynh (1 dòng duy nhất). */
export const appSettings = pgTable(
  'app_settings',
  {
    id: integer('id').primaryKey().default(1),
    soundEnabled: boolean('sound_enabled').notNull().default(true),
    reducedMotion: boolean('reduced_motion').notNull().default(false),
    /** scrypt$<salt>$<hash> – không bao giờ lưu PIN dạng văn bản. */
    pinHash: text('pin_hash'),
    sessionSecret: text('session_secret'),
    /** Tăng khi đổi PIN / đăng xuất toàn bộ => vô hiệu hoá các phiên cũ. */
    sessionVersion: integer('session_version').notNull().default(1),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
    /** Mã gia đình (scrypt). NULL = chưa bật, ai có link cũng vào được. */
    familyCodeHash: text('family_code_hash'),
    /** Tăng khi đổi mã / "đăng xuất mọi máy" => các máy đã nhớ mã phải nhập lại. */
    familyVersion: integer('family_version').notNull().default(1),
    failedFamilyAttempts: integer('failed_family_attempts').notNull().default(0),
    familyLockedUntil: timestamp('family_locked_until', { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [check('app_settings_singleton', sql`${t.id} = 1`)],
);

export const schema = {
  progress,
  quizSessions,
  quizAnswers,
  giftOpenings,
  rewards,
  chapterProgress,
  appSettings,
};

export type ProgressRow = typeof progress.$inferSelect;
export type QuizSessionRow = typeof quizSessions.$inferSelect;
export type QuizAnswerRow = typeof quizAnswers.$inferSelect;
export type RewardRow = typeof rewards.$inferSelect;
export type GiftOpeningRow = typeof giftOpenings.$inferSelect;
export type ChapterProgressRow = typeof chapterProgress.$inferSelect;
export type AppSettingsRow = typeof appSettings.$inferSelect;
