/**
 * "Thử thách 60 giây" (nhóm 5–9 tuổi): server sinh đề và tự chấm.
 * Client gửi lần lượt các câu đã trả lời (đúng thứ tự đề); server kiểm tra thứ tự,
 * thời gian (không quá nhanh, không quá hạn) rồi đếm câu đúng và cộng xu.
 */
import { and, count, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { challengeRuns } from '../../db/schema.js';
import {
  CHALLENGE_GRACE_MS,
  CHALLENGE_MIN_MS_PER_ANSWER,
  CHALLENGE_MS,
  challengeCoins,
  generateChallenge,
  type ChallengeQuestion,
} from '../../src/chapters/primary/rewards.js';
import type { Rng } from '../../src/engine/types.js';
import type { Database } from '../db.js';
import { ApiError, notFound, tooManyRequests, unprocessable } from '../errors.js';
import { earnCoins } from './primaryService.js';

/** Lượt chưa nộp quá thời gian này thì không nộp được nữa. */
export const CHALLENGE_EXPIRY_MS = 10 * 60_000;
const MAX_RUNS_PER_10_MIN = 15;

export interface StartedChallenge {
  runId: string;
  durationMs: number;
  questions: ChallengeQuestion[];
  best: number;
}

async function bestOf(db: Database, familyId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`coalesce(max(${challengeRuns.correct}), 0)::int` })
    .from(challengeRuns)
    .where(and(eq(challengeRuns.familyId, familyId), sql`${challengeRuns.completedAt} is not null`));
  return Number(r?.n ?? 0);
}

export async function startChallenge(db: Database, familyId: string, rng: Rng = Math.random, now = new Date()): Promise<StartedChallenge> {
  const [recent] = await db
    .select({ n: count() })
    .from(challengeRuns)
    .where(and(eq(challengeRuns.familyId, familyId), gt(challengeRuns.startedAt, new Date(now.getTime() - 10 * 60_000))));
  if ((recent?.n ?? 0) >= MAX_RUNS_PER_10_MIN) throw tooManyRequests();
  // Dọn các lượt bỏ dở đã hết hạn.
  await db.delete(challengeRuns).where(and(isNull(challengeRuns.completedAt), lt(challengeRuns.startedAt, new Date(now.getTime() - CHALLENGE_EXPIRY_MS))));
  const questions = generateChallenge(rng);
  const [row] = await db.insert(challengeRuns).values({ familyId, questions, startedAt: now }).returning({ id: challengeRuns.id });
  return { runId: row!.id, durationMs: CHALLENGE_MS, questions, best: await bestOf(db, familyId) };
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

export async function completeChallenge(
  db: Database,
  familyId: string,
  runId: string,
  answers: { questionId: string; value: number }[],
  now = new Date(),
): Promise<ChallengeResult> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(challengeRuns)
      .where(and(eq(challengeRuns.id, runId), eq(challengeRuns.familyId, familyId)))
      .for('update');
    if (!run) throw notFound('Không tìm thấy lượt thử thách');
    if (run.completedAt) {
      const best = await bestOf(tx, familyId);
      return { runId, correct: run.correct, wrong: run.wrong, coinsEarned: 0, best, isRecord: false, alreadyCompleted: true };
    }
    const elapsed = now.getTime() - run.startedAt.getTime();
    if (elapsed > CHALLENGE_EXPIRY_MS) throw new ApiError(410, 'expired', 'Lượt thử thách đã hết hạn');
    if (answers.length > run.questions.length) throw unprocessable('Quá nhiều câu trả lời');
    answers.forEach((a, i) => {
      if (a.questionId !== run.questions[i]!.id) throw unprocessable(`Câu ${i + 1} không khớp đề`);
    });
    // Không thể trả lời nhanh hơn mức tối thiểu trong thời gian đã trôi qua (tính tối đa 60 giây + thời gian trễ).
    const usable = Math.min(elapsed, CHALLENGE_MS + CHALLENGE_GRACE_MS);
    if (answers.length * CHALLENGE_MIN_MS_PER_ANSWER > usable) throw unprocessable('Thời gian làm bài không hợp lệ');

    const correct = answers.filter((a, i) => a.value === run.questions[i]!.answer).length;
    const wrong = answers.length - correct;
    const bestBefore = await bestOf(tx, familyId);
    const coinsEarned = await earnCoins(tx, familyId, challengeCoins(correct), 'challenge', `challenge:${runId}:coin`, now);
    await tx.update(challengeRuns).set({ completedAt: now, correct, wrong }).where(eq(challengeRuns.id, runId));
    return {
      runId,
      correct,
      wrong,
      coinsEarned,
      best: Math.max(bestBefore, correct),
      isRecord: correct > bestBefore,
      alreadyCompleted: false,
    };
  });
}
