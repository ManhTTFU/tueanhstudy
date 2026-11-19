import { eq, sql } from 'drizzle-orm';
import { chapterProgress, progress, rewards, type ChapterProgressRow, type ProgressRow } from '../../db/schema.js';
import { getEnabledChapters } from '../../src/chapters/registry.js';
import { candiesUntilNextGift, giftsAvailable } from '../../src/engine/RewardService.js';
import type { Database } from '../db.js';
import { getPublicSettings, type PublicSettings } from './settingsService.js';

export async function ensureProgressRow(db: Database, forUpdate = false): Promise<ProgressRow> {
  await db.insert(progress).values({ id: 1 }).onConflictDoNothing();
  const query = db.select().from(progress).where(eq(progress.id, 1));
  const rows = forUpdate ? await query.for('update') : await query;
  return rows[0]!;
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
  /** 0–3 sao: đã học thẻ (hoặc không có thẻ) / đã hoàn thành bài / đạt 10/10. */
  stars: number;
}

export interface StickerCount {
  code: string;
  quantity: number;
  firstEarnedAt: string;
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
  /** Tiến độ tổng thể 0–100 dựa trên số sao của các chương. */
  overallProgress: number;
  settings: PublicSettings;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toChapterSummary(chapterId: string, row: ChapterProgressRow | undefined, hasLearningStage: boolean): ChapterSummary {
  const learned = hasLearningStage ? Boolean(row?.learnedAt) || (row?.totalSessions ?? 0) > 0 : (row?.totalSessions ?? 0) > 0;
  const stars = (learned ? 1 : 0) + ((row?.totalSessions ?? 0) > 0 ? 1 : 0) + ((row?.perfectSessions ?? 0) > 0 ? 1 : 0);
  return {
    chapterId,
    totalSessions: row?.totalSessions ?? 0,
    perfectSessions: row?.perfectSessions ?? 0,
    bestScore: row?.bestScore ?? 0,
    totalCorrect: row?.totalCorrect ?? 0,
    totalIncorrect: row?.totalIncorrect ?? 0,
    learnedAt: iso(row?.learnedAt ?? null),
    lastPlayedAt: iso(row?.lastPlayedAt ?? null),
    completedAt: iso(row?.completedAt ?? null),
    stars,
  };
}

export async function getStickerCounts(db: Database): Promise<StickerCount[]> {
  const rows = await db
    .select({
      code: rewards.rewardCode,
      quantity: sql<number>`cast(sum(${rewards.quantity}) as int)`,
      firstEarnedAt: sql<string>`min(${rewards.earnedAt})`,
    })
    .from(rewards)
    .where(eq(rewards.rewardType, 'sticker'))
    .groupBy(rewards.rewardCode);
  return rows.map((r) => ({
    code: r.code,
    quantity: Number(r.quantity),
    firstEarnedAt: new Date(r.firstEarnedAt).toISOString(),
  }));
}

/** Dữ liệu cho trang chủ – vài truy vấn nhỏ, KHÔNG tải lịch sử. */
export async function getSummary(db: Database): Promise<Summary> {
  const p = await ensureProgressRow(db);
  const chapterRows = await db.select().from(chapterProgress);
  const stickers = await getStickerCounts(db);
  const settings = await getPublicSettings(db);
  const chapters = getEnabledChapters().map((c) =>
    toChapterSummary(
      c.id,
      chapterRows.find((r) => r.chapterId === c.id),
      c.hasLearningStage,
    ),
  );
  const maxStars = chapters.length * 3;
  const stars = chapters.reduce((s, c) => s + c.stars, 0);
  return {
    totals: {
      totalCandies: p.totalCandies,
      totalCompletedQuizzes: p.totalCompletedQuizzes,
      totalCorrectAnswers: p.totalCorrectAnswers,
      totalIncorrectAnswers: p.totalIncorrectAnswers,
      giftsOpened: p.giftsOpened,
      giftsAvailable: giftsAvailable(p.totalCandies, p.giftsOpened),
      candiesUntilNextGift: candiesUntilNextGift(p.totalCandies, p.giftsOpened),
    },
    chapters,
    stickers,
    overallProgress: maxStars === 0 ? 0 : Math.round((stars / maxStars) * 100),
    settings,
  };
}

/** Ghi nhận bé đã xem hết thẻ học của chương (chỉ lưu lần đầu). */
export async function markLearned(db: Database, chapterId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(chapterProgress)
    .values({ chapterId, learnedAt: now })
    .onConflictDoUpdate({
      target: chapterProgress.chapterId,
      set: { learnedAt: sql`coalesce(${chapterProgress.learnedAt}, ${now})`, updatedAt: now },
    });
}
