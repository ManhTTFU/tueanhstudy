/**
 * Phiên làm bài phía server.
 *  1. start: server sinh câu hỏi bằng QuizEngine dùng chung, lưu snapshot vào DB.
 *  2. complete: client chỉ gửi các lần chọn; server tự chấm điểm theo lần
 *     trả lời đầu tiên, lưu kết quả + cộng thưởng trong MỘT transaction.
 *     Gọi lặp lại => trả về kết quả cũ, không cộng thưởng thêm.
 */
import { and, count, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import {
  chapterProgress,
  progress,
  quizAnswers,
  quizSessions,
  rewards,
  type QuizSessionRow,
  type StoredQuestion,
} from '../../db/schema.js';
import { isChapterUnlocked, LEVEL_UNLOCK_MIN_SCORE, unlockRequirements } from '../../src/chapters/levels.js';
import { getChapter } from '../../src/chapters/registry.js';
import { encouragementFor } from '../../src/engine/messages.js';
import { evaluateSubmission, generateQuiz, type SubmittedAnswer } from '../../src/engine/QuizEngine.js';
import { computeSessionRewards, giftsAvailable } from '../../src/engine/RewardService.js';
import type { Question, RewardGrant, Rng } from '../../src/engine/types.js';
import type { Database } from '../db.js';
import { ApiError, forbidden, notFound, tooManyRequests, unprocessable } from '../errors.js';
import { ensureProgressRow } from './progressService.js';

/** Số phiên được mở tối đa trong 10 phút (chống gửi yêu cầu liên tục, bền vững trong DB). */
export const MAX_SESSIONS_PER_10_MIN = 40;
/** Phiên chưa hoàn thành quá thời gian này sẽ bị dọn và không thể nộp. */
export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface StartedSession {
  sessionId: string;
  chapterId: string;
  startedAt: string;
  questions: Question[];
}

export async function startSession(
  db: Database,
  familyId: string,
  chapterId: string,
  rng: Rng = Math.random,
  now = new Date(),
): Promise<StartedSession> {
  const chapter = getChapter(chapterId);
  if (!chapter || !chapter.enabled || chapter.hubOnly) throw notFound('Không tìm thấy chương học');

  // Cấp chưa mở khoá: không cho bắt đầu bài (client chỉ hiển thị khoá, server mới chặn thật).
  const required = unlockRequirements(chapter);
  if (required.length > 0) {
    const rows = await db
      .select({ chapterId: chapterProgress.chapterId, bestScore: chapterProgress.bestScore })
      .from(chapterProgress)
      .where(and(eq(chapterProgress.familyId, familyId), inArray(chapterProgress.chapterId, required.map((c) => c.id))));
    const best = (id: string) => rows.find((r) => r.chapterId === id)?.bestScore ?? 0;
    if (!isChapterUnlocked(chapter, best)) {
      throw forbidden('level_locked', `Bé cần đạt ${LEVEL_UNLOCK_MIN_SCORE} điểm ở các trò cấp trước để mở cấp này`, {
        required: required.map((c) => ({ chapterId: c.id, bestScore: best(c.id) })),
      });
    }
  }

  const [recent] = await db
    .select({ n: count() })
    .from(quizSessions)
    .where(and(eq(quizSessions.familyId, familyId), gt(quizSessions.startedAt, new Date(now.getTime() - 10 * 60 * 1000))));
  if ((recent?.n ?? 0) >= MAX_SESSIONS_PER_10_MIN) throw tooManyRequests();

  // Dọn các phiên bỏ dở quá hạn để database luôn gọn nhẹ.
  await db
    .delete(quizSessions)
    .where(
      and(
        eq(quizSessions.status, 'in_progress'),
        lt(quizSessions.startedAt, new Date(now.getTime() - SESSION_EXPIRY_MS)),
      ),
    );

  const questions = generateQuiz(chapter, rng) as Question[];
  const [row] = await db
    .insert(quizSessions)
    .values({
      familyId,
      chapterId: chapter.id,
      chapterName: chapter.fullName ?? chapter.name,
      status: 'in_progress',
      questions: questions as StoredQuestion[],
      totalQuestions: questions.length,
      startedAt: now,
    })
    .returning({ id: quizSessions.id, startedAt: quizSessions.startedAt });

  return { sessionId: row!.id, chapterId: chapter.id, startedAt: row!.startedAt.toISOString(), questions };
}

export interface CompletedSessionResult {
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
  rewards: RewardGrant[];
  alreadyCompleted: boolean;
  totals: { totalCandies: number; giftsAvailable: number };
  saved: true;
}

export async function completeSession(
  db: Database,
  familyId: string,
  sessionId: string,
  answers: SubmittedAnswer[],
  now = new Date(),
): Promise<CompletedSessionResult> {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.familyId, familyId)))
      .for('update');
    if (!session) throw notFound('Không tìm thấy phiên học');

    if (session.status === 'completed') {
      return buildExistingResult(tx, session);
    }

    const chapter = getChapter(session.chapterId);
    if (!chapter) throw notFound('Chương học không còn tồn tại');

    const elapsed = now.getTime() - session.startedAt.getTime();
    if (elapsed > SESSION_EXPIRY_MS) throw new ApiError(410, 'expired', 'Phiên học đã hết hạn');
    if (elapsed < chapter.quiz.minDurationMs) {
      throw unprocessable('Thời gian làm bài không hợp lệ');
    }

    const evaluation = evaluateSubmission(session.questions, answers);
    if (!evaluation.ok) throw unprocessable(evaluation.error);
    const { score } = evaluation;

    await tx.insert(quizAnswers).values(
      evaluation.answers.map((a) => ({
        sessionId,
        questionIndex: a.questionIndex,
        questionId: a.questionId,
        questionType: a.questionType,
        correctAnswer: a.correctAnswer,
        selectedAnswer: a.selectedAnswer,
        attemptHistory: a.attemptHistory,
        isCorrect: a.isCorrect,
        attempts: a.attempts,
      })),
    );

    const p = await ensureProgressRow(tx, familyId, true);
    const [perfectBefore] = await tx
      .select({ n: count() })
      .from(quizSessions)
      .where(
        and(eq(quizSessions.familyId, familyId), eq(quizSessions.status, 'completed'), eq(quizSessions.isPerfectScore, true)),
      );

    const grants = computeSessionRewards({
      sessionId,
      chapterId: chapter.id,
      chapterRewards: chapter.rewards,
      score,
      completedQuizzesAfter: p.totalCompletedQuizzes + 1,
      perfectSessionsAfter: (perfectBefore?.n ?? 0) + (score.isPerfectScore ? 1 : 0),
    });

    // ON CONFLICT (dedupe_key) DO NOTHING => phần thưởng đã nhận sẽ không bị cộng lại.
    const inserted = grants.length
      ? await tx
          .insert(rewards)
          .values(
            grants.map((g) => ({
              familyId,
              rewardType: g.rewardType,
              rewardCode: g.rewardCode,
              quantity: g.quantity,
              dedupeKey: g.dedupeKey,
              sourceSessionId: sessionId,
              earnedAt: now,
            })),
          )
          .onConflictDoNothing({ target: [rewards.familyId, rewards.dedupeKey] })
          .returning({ dedupeKey: rewards.dedupeKey })
      : [];
    const insertedKeys = new Set(inserted.map((r) => r.dedupeKey));
    const newGrants = grants.filter((g) => insertedKeys.has(g.dedupeKey));
    const candiesEarned = newGrants.filter((g) => g.rewardType === 'candy').reduce((s, g) => s + g.quantity, 0);

    await tx
      .update(quizSessions)
      .set({
        status: 'completed',
        completedAt: now,
        correctAnswers: score.correctAnswers,
        incorrectAnswers: score.incorrectAnswers,
        score: score.score,
        isPerfectScore: score.isPerfectScore,
        candiesEarned,
      })
      .where(eq(quizSessions.id, sessionId));

    const [updatedProgress] = await tx
      .update(progress)
      .set({
        totalCandies: sql`${progress.totalCandies} + ${candiesEarned}`,
        totalCompletedQuizzes: sql`${progress.totalCompletedQuizzes} + 1`,
        totalCorrectAnswers: sql`${progress.totalCorrectAnswers} + ${score.correctAnswers}`,
        totalIncorrectAnswers: sql`${progress.totalIncorrectAnswers} + ${score.incorrectAnswers}`,
        updatedAt: now,
      })
      .where(eq(progress.familyId, familyId))
      .returning();

    await tx
      .insert(chapterProgress)
      .values({
        familyId,
        chapterId: chapter.id,
        totalSessions: 1,
        perfectSessions: score.isPerfectScore ? 1 : 0,
        bestScore: score.score,
        totalCorrect: score.correctAnswers,
        totalIncorrect: score.incorrectAnswers,
        lastPlayedAt: now,
        completedAt: now,
      })
      .onConflictDoUpdate({
        target: [chapterProgress.familyId, chapterProgress.chapterId],
        set: {
          totalSessions: sql`${chapterProgress.totalSessions} + 1`,
          perfectSessions: sql`${chapterProgress.perfectSessions} + ${score.isPerfectScore ? 1 : 0}`,
          bestScore: sql`greatest(${chapterProgress.bestScore}, ${score.score})`,
          totalCorrect: sql`${chapterProgress.totalCorrect} + ${score.correctAnswers}`,
          totalIncorrect: sql`${chapterProgress.totalIncorrect} + ${score.incorrectAnswers}`,
          lastPlayedAt: now,
          completedAt: sql`coalesce(${chapterProgress.completedAt}, ${now})`,
          updatedAt: now,
        },
      });

    return {
      sessionId,
      chapterId: chapter.id,
      ...score,
      completedAt: now.toISOString(),
      encouragement: encouragementFor(score.score),
      candiesEarned,
      rewards: newGrants,
      alreadyCompleted: false,
      totals: {
        totalCandies: updatedProgress!.totalCandies,
        giftsAvailable: giftsAvailable(updatedProgress!.totalCandies, updatedProgress!.giftsOpened),
      },
      saved: true,
    };
  });
}

async function buildExistingResult(db: Database, session: QuizSessionRow): Promise<CompletedSessionResult> {
  const p = await ensureProgressRow(db, session.familyId);
  return {
    sessionId: session.id,
    chapterId: session.chapterId,
    totalQuestions: session.totalQuestions,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers,
    score: session.score,
    percent: session.totalQuestions ? Math.round((session.correctAnswers / session.totalQuestions) * 100) : 0,
    isPerfectScore: session.isPerfectScore,
    completedAt: (session.completedAt ?? new Date()).toISOString(),
    encouragement: encouragementFor(session.score),
    candiesEarned: session.candiesEarned,
    rewards: [],
    alreadyCompleted: true,
    totals: { totalCandies: p.totalCandies, giftsAvailable: giftsAvailable(p.totalCandies, p.giftsOpened) },
    saved: true,
  };
}
