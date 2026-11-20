/**
 * Xuất / nhập / xoá dữ liệu học tập.
 *  - File JSON có `format` + `schemaVersion` để nâng cấp về sau (xem upgradeBackup).
 *  - Nhập dữ liệu: kiểm tra cấu trúc + ràng buộc tham chiếu TRƯỚC, sau đó ghi đè
 *    toàn bộ trong MỘT transaction (lỗi giữa chừng => không thay đổi gì).
 *  - Mã PIN, mã gia đình và khoá bí mật KHÔNG bao giờ được xuất ra file.
 *  - Mỗi gia đình chỉ xuất / nhập / xoá dữ liệu CỦA MÌNH. Khi nhập, mã phiên học và
 *    hộp quà được cấp mới (nhập file của gia đình khác cũng không đụng dữ liệu của họ).
 */
import { randomUUID } from 'node:crypto';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  challengeRuns,
  chapterProgress,
  coinLedger,
  families,
  giftOpenings,
  progress,
  quizAnswers,
  quizSessions,
  redemptions,
  reviewItems,
  rewards,
  shopRewards,
} from '../../db/schema.js';
import { MAX_INPUT_ATTEMPTS } from '../../src/engine/QuizEngine.js';
import type { Database } from '../db.js';
import { unprocessable } from '../errors.js';
import { getFamilyRow, toPublicSettings } from './settingsService.js';

export const BACKUP_FORMAT = 'be-vui-hoc-toan-backup';
/** 2: thêm xu, quà thật, lượt đổi quà, Thử thách 60 giây (nhóm 5–9 tuổi) và câu tự gõ. */
export const BACKUP_SCHEMA_VERSION = 2;

const isoDate = z.iso.datetime({ offset: true });
const nullableIsoDate = isoDate.nullable();
const int = z.number().int();
const nonNeg = int.min(0);

const questionSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.string().min(1).max(64),
  prompt: z.string().max(500),
  payload: z.record(z.string(), z.unknown()),
  correctAnswer: int,
  // Câu tự gõ (nhóm 5–9 tuổi) không có phương án.
  options: z.array(int).max(10),
  input: z.boolean().optional(),
});

const answerSchema = z.object({
  questionIndex: nonNeg,
  questionId: z.string().min(1).max(128),
  questionType: z.string().min(1).max(64),
  correctAnswer: int,
  selectedAnswer: int,
  attemptHistory: z.array(int).min(1).max(MAX_INPUT_ATTEMPTS),
  isCorrect: z.boolean(),
  attempts: int.min(1).max(MAX_INPUT_ATTEMPTS),
});

const sessionSchema = z.object({
  id: z.uuid(),
  chapterId: z.string().min(1).max(64),
  chapterName: z.string().min(1).max(200),
  startedAt: isoDate,
  completedAt: isoDate,
  totalQuestions: int.min(1).max(100),
  correctAnswers: nonNeg,
  incorrectAnswers: nonNeg,
  score: int.min(0).max(10),
  isPerfectScore: z.boolean(),
  candiesEarned: nonNeg,
  questions: z.array(questionSchema).max(100),
  answers: z.array(answerSchema).max(100),
});

const rewardSchema = z.object({
  rewardType: z.enum(['candy', 'sticker']),
  rewardCode: z.string().min(1).max(64),
  quantity: int.min(1).max(1000),
  earnedAt: isoDate,
  sourceSessionId: z.uuid().nullable(),
  sourceGiftId: z.uuid().nullable(),
  dedupeKey: z.string().min(1).max(200),
});

const giftSchema = z.object({ id: z.uuid(), stickerCode: z.string().min(1).max(64), openedAt: isoDate });

const coinSchema = z.object({
  amount: int.min(1).max(100_000),
  reason: z.enum(['session', 'challenge']),
  dedupeKey: z.string().min(1).max(200),
  earnedAt: isoDate,
});
const shopRewardSchema = z.object({ id: z.uuid(), name: z.string().min(1).max(60), cost: int.min(1).max(100_000), active: z.boolean(), createdAt: isoDate });
const redemptionSchema = z.object({
  id: z.uuid(),
  rewardId: z.uuid().nullable(),
  name: z.string().min(1).max(60),
  cost: int.min(1).max(100_000),
  redeemedAt: isoDate,
  deliveredAt: nullableIsoDate,
});
const challengeSchema = z.object({ id: z.uuid(), startedAt: isoDate, completedAt: isoDate, correct: nonNeg, wrong: nonNeg });

const chapterProgressSchema = z.object({
  chapterId: z.string().min(1).max(64),
  totalSessions: nonNeg,
  perfectSessions: nonNeg,
  bestScore: int.min(0).max(10),
  totalCorrect: nonNeg,
  totalIncorrect: nonNeg,
  learnedAt: nullableIsoDate,
  lastPlayedAt: nullableIsoDate,
  completedAt: nullableIsoDate,
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: isoDate,
  data: z.object({
    progress: z.object({
      totalCandies: nonNeg,
      totalCompletedQuizzes: nonNeg,
      totalCorrectAnswers: nonNeg,
      totalIncorrectAnswers: nonNeg,
      giftsOpened: nonNeg,
    }),
    chapterProgress: z.array(chapterProgressSchema).max(500),
    sessions: z.array(sessionSchema).max(20_000),
    rewards: z.array(rewardSchema).max(100_000),
    giftOpenings: z.array(giftSchema).max(10_000),
    coins: z.array(coinSchema).max(100_000),
    shopRewards: z.array(shopRewardSchema).max(500),
    redemptions: z.array(redemptionSchema).max(10_000),
    challenges: z.array(challengeSchema).max(20_000),
    // ageGroup: thêm sau (tuỳ chọn) – file sao lưu cũ không có vẫn nhập được.
    settings: z.object({ soundEnabled: z.boolean(), reducedMotion: z.boolean(), ageGroup: z.enum(['preschool', 'primary']).optional() }),
  }),
});

export type BackupFile = z.infer<typeof backupSchema>;

/**
 * Nâng cấp file sao lưu cũ lên phiên bản hiện tại.
 * Khi đổi schema: tăng BACKUP_SCHEMA_VERSION và thêm bước chuyển đổi ở đây.
 */
export function upgradeBackup(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version === 'number' && version > BACKUP_SCHEMA_VERSION) {
    throw unprocessable(`File được tạo bởi phiên bản mới hơn (schemaVersion ${version}). Hãy cập nhật ứng dụng.`);
  }
  // 1 -> 2: chưa có xu / quà thật / thử thách.
  if (version === 1) {
    const r = raw as { data?: Record<string, unknown> };
    return {
      ...r,
      schemaVersion: 2,
      data: { coins: [], shopRewards: [], redemptions: [], challenges: [], ...(r.data ?? {}) },
    };
  }
  return raw;
}

export function validateBackup(raw: unknown): BackupFile {
  const upgraded = upgradeBackup(raw);
  const parsed = backupSchema.safeParse(upgraded);
  if (!parsed.success) {
    throw unprocessable(
      'File sao lưu không hợp lệ',
      parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const backup = parsed.data;
  // Ràng buộc logic & tham chiếu
  const sessionIds = new Set<string>();
  for (const s of backup.data.sessions) {
    if (sessionIds.has(s.id)) throw unprocessable(`Phiên học bị trùng: ${s.id}`);
    sessionIds.add(s.id);
    if (s.correctAnswers + s.incorrectAnswers !== s.totalQuestions) {
      throw unprocessable(`Số câu đúng/sai không khớp ở phiên ${s.id}`);
    }
    if (s.answers.length !== s.totalQuestions) {
      throw unprocessable(`Số câu trả lời không khớp ở phiên ${s.id}`);
    }
    if (new Set(s.answers.map((a) => a.questionIndex)).size !== s.answers.length) {
      throw unprocessable(`Câu trả lời bị trùng ở phiên ${s.id}`);
    }
  }
  const giftIds = new Set(backup.data.giftOpenings.map((g) => g.id));
  if (giftIds.size !== backup.data.giftOpenings.length) throw unprocessable('Hộp quà bị trùng');
  const dedupe = new Set<string>();
  for (const r of backup.data.rewards) {
    if (dedupe.has(r.dedupeKey)) throw unprocessable(`Phần thưởng bị trùng: ${r.dedupeKey}`);
    dedupe.add(r.dedupeKey);
    if (r.sourceSessionId && !sessionIds.has(r.sourceSessionId)) {
      throw unprocessable('Phần thưởng tham chiếu tới phiên học không tồn tại');
    }
    if (r.sourceGiftId && !giftIds.has(r.sourceGiftId)) {
      throw unprocessable('Phần thưởng tham chiếu tới hộp quà không tồn tại');
    }
  }
  const chapterIds = new Set<string>();
  for (const c of backup.data.chapterProgress) {
    if (chapterIds.has(c.chapterId)) throw unprocessable(`Tiến độ chương bị trùng: ${c.chapterId}`);
    chapterIds.add(c.chapterId);
  }
  const candyTotal = backup.data.rewards.filter((r) => r.rewardType === 'candy').reduce((s, r) => s + r.quantity, 0);
  if (candyTotal !== backup.data.progress.totalCandies) {
    throw unprocessable('Tổng số kẹo không khớp với danh sách phần thưởng');
  }
  if (backup.data.giftOpenings.length !== backup.data.progress.giftsOpened) {
    throw unprocessable('Số hộp quà đã mở không khớp');
  }
  const coinKeys = new Set(backup.data.coins.map((c) => c.dedupeKey));
  if (coinKeys.size !== backup.data.coins.length) throw unprocessable('Xu bị trùng');
  const shopIds = new Set(backup.data.shopRewards.map((r) => r.id));
  if (shopIds.size !== backup.data.shopRewards.length) throw unprocessable('Món quà bị trùng');
  if (new Set(backup.data.redemptions.map((r) => r.id)).size !== backup.data.redemptions.length) throw unprocessable('Lượt đổi quà bị trùng');
  if (backup.data.redemptions.some((r) => r.rewardId && !shopIds.has(r.rewardId))) throw unprocessable('Lượt đổi quà tham chiếu tới món quà không tồn tại');
  const earned = backup.data.coins.reduce((s, c) => s + c.amount, 0);
  const spent = backup.data.redemptions.reduce((s, r) => s + r.cost, 0);
  if (spent > earned) throw unprocessable('Số xu đã đổi quà nhiều hơn số xu kiếm được');
  return backup;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function exportBackup(db: Database, familyId: string, now = new Date()): Promise<BackupFile> {
  const [p] = await db.select().from(progress).where(eq(progress.familyId, familyId));
  const chapters = await db
    .select()
    .from(chapterProgress)
    .where(eq(chapterProgress.familyId, familyId))
    .orderBy(asc(chapterProgress.chapterId));
  const sessions = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.familyId, familyId))
    .orderBy(asc(quizSessions.startedAt));
  const sessionIds = sessions.map((x) => x.id);
  const answers = sessionIds.length
    ? await db
        .select()
        .from(quizAnswers)
        .where(inArray(quizAnswers.sessionId, sessionIds))
        .orderBy(asc(quizAnswers.sessionId), asc(quizAnswers.questionIndex))
    : [];
  const rewardRows = await db.select().from(rewards).where(eq(rewards.familyId, familyId)).orderBy(asc(rewards.id));
  const gifts = await db
    .select()
    .from(giftOpenings)
    .where(eq(giftOpenings.familyId, familyId))
    .orderBy(asc(giftOpenings.openedAt));
  const settings = await getFamilyRow(db, familyId);
  const coinRows = await db.select().from(coinLedger).where(eq(coinLedger.familyId, familyId)).orderBy(asc(coinLedger.id));
  const shopRows = await db.select().from(shopRewards).where(eq(shopRewards.familyId, familyId)).orderBy(asc(shopRewards.createdAt));
  const redemptionRows = await db.select().from(redemptions).where(eq(redemptions.familyId, familyId)).orderBy(asc(redemptions.redeemedAt));
  const challengeRows = await db.select().from(challengeRuns).where(eq(challengeRuns.familyId, familyId)).orderBy(asc(challengeRuns.startedAt));

  const answersBySession = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = answersBySession.get(a.sessionId) ?? [];
    list.push(a);
    answersBySession.set(a.sessionId, list);
  }
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const completedIds = new Set(completedSessions.map((s) => s.id));

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    data: {
      progress: {
        totalCandies: p?.totalCandies ?? 0,
        totalCompletedQuizzes: p?.totalCompletedQuizzes ?? 0,
        totalCorrectAnswers: p?.totalCorrectAnswers ?? 0,
        totalIncorrectAnswers: p?.totalIncorrectAnswers ?? 0,
        giftsOpened: p?.giftsOpened ?? 0,
      },
      chapterProgress: chapters.map((c) => ({
        chapterId: c.chapterId,
        totalSessions: c.totalSessions,
        perfectSessions: c.perfectSessions,
        bestScore: c.bestScore,
        totalCorrect: c.totalCorrect,
        totalIncorrect: c.totalIncorrect,
        learnedAt: iso(c.learnedAt),
        lastPlayedAt: iso(c.lastPlayedAt),
        completedAt: iso(c.completedAt),
      })),
      sessions: completedSessions.map((s) => ({
        id: s.id,
        chapterId: s.chapterId,
        chapterName: s.chapterName,
        startedAt: s.startedAt.toISOString(),
        completedAt: (s.completedAt ?? s.startedAt).toISOString(),
        totalQuestions: s.totalQuestions,
        correctAnswers: s.correctAnswers,
        incorrectAnswers: s.incorrectAnswers,
        score: s.score,
        isPerfectScore: s.isPerfectScore,
        candiesEarned: s.candiesEarned,
        questions: s.questions,
        answers: (answersBySession.get(s.id) ?? []).map((a) => ({
          questionIndex: a.questionIndex,
          questionId: a.questionId,
          questionType: a.questionType,
          correctAnswer: a.correctAnswer,
          selectedAnswer: a.selectedAnswer,
          attemptHistory: a.attemptHistory,
          isCorrect: a.isCorrect,
          attempts: a.attempts,
        })),
      })),
      rewards: rewardRows.map((r) => ({
        rewardType: r.rewardType as 'candy' | 'sticker',
        rewardCode: r.rewardCode,
        quantity: r.quantity,
        earnedAt: r.earnedAt.toISOString(),
        sourceSessionId: r.sourceSessionId && completedIds.has(r.sourceSessionId) ? r.sourceSessionId : null,
        sourceGiftId: r.sourceGiftId,
        dedupeKey: r.dedupeKey,
      })),
      giftOpenings: gifts.map((g) => ({ id: g.id, stickerCode: g.stickerCode, openedAt: g.openedAt.toISOString() })),
      coins: coinRows.map((c) => ({
        amount: c.amount,
        reason: c.reason as 'session' | 'challenge',
        dedupeKey: c.dedupeKey,
        earnedAt: c.earnedAt.toISOString(),
      })),
      shopRewards: shopRows.map((r) => ({ id: r.id, name: r.name, cost: r.cost, active: r.active, createdAt: r.createdAt.toISOString() })),
      redemptions: redemptionRows.map((r) => ({
        id: r.id,
        rewardId: r.rewardId,
        name: r.name,
        cost: r.cost,
        redeemedAt: r.redeemedAt.toISOString(),
        deliveredAt: iso(r.deliveredAt),
      })),
      challenges: challengeRows
        .filter((c) => c.completedAt)
        .map((c) => ({ id: c.id, startedAt: c.startedAt.toISOString(), completedAt: c.completedAt!.toISOString(), correct: c.correct, wrong: c.wrong })),
      settings: { soundEnabled: settings.soundEnabled, reducedMotion: settings.reducedMotion, ageGroup: toPublicSettings(settings).ageGroup },
    },
  };
}

/** Xoá toàn bộ dữ liệu học tập CỦA GIA ĐÌNH (giữ nguyên tên, mã, PIN & cài đặt). */
async function clearLearningData(tx: Database, familyId: string): Promise<void> {
  // quiz_answers tự xoá theo quiz_sessions (ON DELETE CASCADE).
  // Danh sách quà (shop_rewards) là cài đặt của phụ huynh nên được giữ lại khi xoá dữ liệu học tập.
  await tx.delete(coinLedger).where(eq(coinLedger.familyId, familyId));
  await tx.delete(redemptions).where(eq(redemptions.familyId, familyId));
  await tx.delete(reviewItems).where(eq(reviewItems.familyId, familyId));
  await tx.delete(challengeRuns).where(eq(challengeRuns.familyId, familyId));
  await tx.delete(rewards).where(eq(rewards.familyId, familyId));
  await tx.delete(giftOpenings).where(eq(giftOpenings.familyId, familyId));
  await tx.delete(quizSessions).where(eq(quizSessions.familyId, familyId));
  await tx.delete(chapterProgress).where(eq(chapterProgress.familyId, familyId));
  await tx.delete(progress).where(eq(progress.familyId, familyId));
}

export async function resetAllData(db: Database, familyId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await getFamilyRow(tx, familyId, true);
    await clearLearningData(tx, familyId);
    await tx.insert(progress).values({ familyId });
  });
}

const CHUNK = 500;
async function insertChunked<T>(items: T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) await insert(items.slice(i, i + CHUNK));
}

export async function importBackup(db: Database, familyId: string, raw: unknown): Promise<{ sessions: number; rewards: number }> {
  const backup = validateBackup(raw);
  const { data } = backup;
  // Cấp mã mới cho phiên học & hộp quà: mã cũ có thể đang được gia đình khác dùng.
  const sessionIdMap = new Map(data.sessions.map((x) => [x.id, randomUUID()]));
  const giftIdMap = new Map(data.giftOpenings.map((g) => [g.id, randomUUID()]));
  const shopIdMap = new Map(data.shopRewards.map((r) => [r.id, randomUUID()]));
  const challengeIdMap = new Map(data.challenges.map((c) => [c.id, randomUUID()]));
  const remapKey = (key: string) =>
    key.replace(/^(session:)([0-9a-f-]{36})/i, (m, p1: string, id: string) => (sessionIdMap.has(id) ? p1 + sessionIdMap.get(id) : m))
      .replace(/^(gift:)([0-9a-f-]{36})/i, (m, p1: string, id: string) => (giftIdMap.has(id) ? p1 + giftIdMap.get(id) : m))
      .replace(/^(challenge:)([0-9a-f-]{36})/i, (m, p1: string, id: string) => (challengeIdMap.has(id) ? p1 + challengeIdMap.get(id) : m));
  await db.transaction(async (tx) => {
    await getFamilyRow(tx, familyId, true);
    await clearLearningData(tx, familyId);
    await tx.insert(progress).values({ familyId, ...data.progress });
    await insertChunked(data.chapterProgress, (chunk) =>
      tx.insert(chapterProgress).values(
        chunk.map((c) => ({
          ...c,
          familyId,
          learnedAt: c.learnedAt ? new Date(c.learnedAt) : null,
          lastPlayedAt: c.lastPlayedAt ? new Date(c.lastPlayedAt) : null,
          completedAt: c.completedAt ? new Date(c.completedAt) : null,
        })),
      ),
    );
    await insertChunked(data.sessions, (chunk) =>
      tx.insert(quizSessions).values(
        chunk.map((s) => ({
          id: sessionIdMap.get(s.id)!,
          familyId,
          chapterId: s.chapterId,
          chapterName: s.chapterName,
          status: 'completed',
          questions: s.questions,
          startedAt: new Date(s.startedAt),
          completedAt: new Date(s.completedAt),
          totalQuestions: s.totalQuestions,
          correctAnswers: s.correctAnswers,
          incorrectAnswers: s.incorrectAnswers,
          score: s.score,
          isPerfectScore: s.isPerfectScore,
          candiesEarned: s.candiesEarned,
        })),
      ),
    );
    const answerRows = data.sessions.flatMap((s) => s.answers.map((a) => ({ ...a, sessionId: sessionIdMap.get(s.id)! })));
    await insertChunked(answerRows, (chunk) => tx.insert(quizAnswers).values(chunk));
    await insertChunked(data.giftOpenings, (chunk) =>
      tx.insert(giftOpenings).values(
        chunk.map((g) => ({ ...g, id: giftIdMap.get(g.id)!, familyId, openedAt: new Date(g.openedAt) })),
      ),
    );
    await insertChunked(data.rewards, (chunk) =>
      tx.insert(rewards).values(
        chunk.map((r) => ({
          ...r,
          familyId,
          dedupeKey: remapKey(r.dedupeKey),
          sourceSessionId: r.sourceSessionId ? sessionIdMap.get(r.sourceSessionId)! : null,
          sourceGiftId: r.sourceGiftId ? giftIdMap.get(r.sourceGiftId)! : null,
          earnedAt: new Date(r.earnedAt),
        })),
      ),
    );
    // Nhóm 5–9 tuổi: quà thật (thay toàn bộ), lượt đổi quà, xu, thử thách – cấp mã mới.
    await tx.delete(shopRewards).where(eq(shopRewards.familyId, familyId));
    await insertChunked(data.shopRewards, (chunk) =>
      tx.insert(shopRewards).values(chunk.map((r) => ({ ...r, id: shopIdMap.get(r.id)!, familyId, createdAt: new Date(r.createdAt) }))),
    );
    await insertChunked(data.redemptions, (chunk) =>
      tx.insert(redemptions).values(
        chunk.map((r) => ({
          ...r,
          id: randomUUID(),
          familyId,
          rewardId: r.rewardId ? shopIdMap.get(r.rewardId)! : null,
          redeemedAt: new Date(r.redeemedAt),
          deliveredAt: r.deliveredAt ? new Date(r.deliveredAt) : null,
        })),
      ),
    );
    await insertChunked(data.challenges, (chunk) =>
      tx.insert(challengeRuns).values(
        chunk.map((c) => ({
          id: challengeIdMap.get(c.id)!,
          familyId,
          questions: [],
          startedAt: new Date(c.startedAt),
          completedAt: new Date(c.completedAt),
          correct: c.correct,
          wrong: c.wrong,
        })),
      ),
    );
    await insertChunked(data.coins, (chunk) =>
      tx.insert(coinLedger).values(chunk.map((c) => ({ ...c, familyId, dedupeKey: remapKey(c.dedupeKey), earnedAt: new Date(c.earnedAt) }))),
    );
    await tx
      .update(families)
      .set({
        soundEnabled: data.settings.soundEnabled,
        reducedMotion: data.settings.reducedMotion,
        ...(data.settings.ageGroup ? { ageGroup: data.settings.ageGroup } : {}),
        updatedAt: new Date(),
      })
      .where(eq(families.id, familyId));
  });
  return { sessions: data.sessions.length, rewards: data.rewards.length };
}
