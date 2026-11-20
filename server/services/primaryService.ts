/**
 * Nhóm 5–9 tuổi: xu, ôn câu sai, đổi quà thật, bảng xếp hạng.
 *  - Xu kiếm được ghi vào coin_ledger (có dedupe_key => không cộng trùng).
 *  - Xu còn lại = tổng xu kiếm được − tổng giá các lần đổi quà (redemptions).
 *  - Đổi quà: khoá dòng progress của gia đình để hai lần bấm cùng lúc không trừ quá số xu.
 */
import { and, asc, count, desc, eq, gte, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { challengeRuns, coinLedger, families, redemptions, reviewItems, shopRewards, type StoredQuestion } from '../../db/schema.js';
import { MAX_REVIEW_ITEMS, REVIEW_QUIZ_SIZE, reviewItemKey, weekStart } from '../../src/chapters/primary/rewards.js';
import type { EvaluatedAnswer } from '../../src/engine/QuizEngine.js';
import { shuffle } from '../../src/engine/random.js';
import type { Rng } from '../../src/engine/types.js';
import type { Database } from '../db.js';
import { ApiError, conflict, notFound } from '../errors.js';
import { ensureProgressRow } from './progressService.js';

// ---------- Xu ----------

export interface CoinBalance {
  earned: number;
  spent: number;
  balance: number;
}

export async function getCoinBalance(db: Database, familyId: string): Promise<CoinBalance> {
  const [e] = await db
    .select({ n: sql<number>`coalesce(sum(${coinLedger.amount}), 0)::int` })
    .from(coinLedger)
    .where(eq(coinLedger.familyId, familyId));
  const [s] = await db
    .select({ n: sql<number>`coalesce(sum(${redemptions.cost}), 0)::int` })
    .from(redemptions)
    .where(eq(redemptions.familyId, familyId));
  const earned = Number(e?.n ?? 0);
  const spent = Number(s?.n ?? 0);
  return { earned, spent, balance: earned - spent };
}

/** Cộng xu (bỏ qua nếu `dedupeKey` đã có). Trả về số xu thực sự được cộng. */
export async function earnCoins(
  tx: Database,
  familyId: string,
  amount: number,
  reason: 'session' | 'challenge',
  dedupeKey: string,
  now: Date,
): Promise<number> {
  if (amount <= 0) return 0;
  const inserted = await tx
    .insert(coinLedger)
    .values({ familyId, amount, reason, dedupeKey, earnedAt: now })
    .onConflictDoNothing({ target: [coinLedger.familyId, coinLedger.dedupeKey] })
    .returning({ id: coinLedger.id });
  return inserted.length ? amount : 0;
}

// ---------- Ôn câu sai ----------

/**
 * Sau mỗi bài: câu sai lần đầu => thêm vào danh sách ôn; câu đúng ngay lần đầu => xoá khỏi danh sách.
 * Bài ôn (`isReview`) dùng luôn id câu hỏi làm khoá.
 */
export async function updateReviewItems(
  tx: Database,
  familyId: string,
  chapterId: string,
  isReview: boolean,
  questions: readonly StoredQuestion[],
  answers: readonly EvaluatedAnswer[],
  now: Date,
): Promise<void> {
  const keyOf = (q: StoredQuestion) => (isReview ? q.id : reviewItemKey(chapterId, q.id));
  const solved = answers.filter((a) => a.isCorrect).map((a) => keyOf(questions[a.questionIndex]!));
  if (solved.length) {
    await tx.delete(reviewItems).where(and(eq(reviewItems.familyId, familyId), inArray(reviewItems.itemKey, solved)));
  }
  const missed = answers.filter((a) => !a.isCorrect).map((a) => questions[a.questionIndex]!);
  if (missed.length && !isReview) {
    await tx
      .insert(reviewItems)
      .values(missed.map((q) => ({ familyId, itemKey: keyOf(q), chapterId, question: q, createdAt: now })))
      .onConflictDoNothing({ target: [reviewItems.familyId, reviewItems.itemKey] });
    // Giữ tối đa MAX_REVIEW_ITEMS câu mới nhất.
    const keep = await tx
      .select({ id: reviewItems.id })
      .from(reviewItems)
      .where(eq(reviewItems.familyId, familyId))
      .orderBy(desc(reviewItems.createdAt), desc(reviewItems.id))
      .limit(MAX_REVIEW_ITEMS);
    await tx.delete(reviewItems).where(
      and(
        eq(reviewItems.familyId, familyId),
        notInArray(
          reviewItems.id,
          keep.map((k) => k.id),
        ),
      ),
    );
  }
}

export async function countReviewItems(db: Database, familyId: string): Promise<number> {
  const [r] = await db.select({ n: count() }).from(reviewItems).where(eq(reviewItems.familyId, familyId));
  return r?.n ?? 0;
}

/** Bộ câu của bài ôn: tối đa REVIEW_QUIZ_SIZE câu, id câu = khoá câu sai. */
export async function pickReviewQuestions(db: Database, familyId: string, rng: Rng): Promise<StoredQuestion[]> {
  const rows = await db.select().from(reviewItems).where(eq(reviewItems.familyId, familyId)).orderBy(asc(reviewItems.createdAt));
  if (rows.length === 0) throw new ApiError(409, 'review_empty', 'Chưa có câu sai nào để ôn. Giỏi quá!');
  return shuffle(rows, rng)
    .slice(0, REVIEW_QUIZ_SIZE)
    .map((r) => ({ ...r.question, id: r.itemKey }));
}

// ---------- Đổi quà ----------

export interface ShopView {
  coins: CoinBalance;
  rewards: { id: string; name: string; cost: number }[];
  redemptions: { id: string; name: string; cost: number; redeemedAt: string; deliveredAt: string | null }[];
}

export const MAX_SHOP_REWARDS = 20;

export async function getShop(db: Database, familyId: string): Promise<ShopView> {
  const coins = await getCoinBalance(db, familyId);
  const items = await db
    .select({ id: shopRewards.id, name: shopRewards.name, cost: shopRewards.cost })
    .from(shopRewards)
    .where(and(eq(shopRewards.familyId, familyId), eq(shopRewards.active, true)))
    .orderBy(asc(shopRewards.cost), asc(shopRewards.createdAt));
  const history = await db
    .select()
    .from(redemptions)
    .where(eq(redemptions.familyId, familyId))
    .orderBy(desc(redemptions.redeemedAt))
    .limit(50);
  return {
    coins,
    rewards: items,
    redemptions: history.map((r) => ({
      id: r.id,
      name: r.name,
      cost: r.cost,
      redeemedAt: r.redeemedAt.toISOString(),
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
    })),
  };
}

/** Bé đổi quà. Gọi lặp với cùng `redemptionId` => không trừ xu lần nữa. */
export async function redeemReward(
  db: Database,
  familyId: string,
  input: { redemptionId: string; rewardId: string },
  now = new Date(),
): Promise<ShopView> {
  await db.transaction(async (tx) => {
    await ensureProgressRow(tx, familyId, true); // khoá theo gia đình
    const [existing] = await tx.select({ familyId: redemptions.familyId }).from(redemptions).where(eq(redemptions.id, input.redemptionId));
    if (existing) {
      if (existing.familyId !== familyId) throw conflict('Mã đổi quà đã được dùng');
      return;
    }
    const [reward] = await tx
      .select()
      .from(shopRewards)
      .where(and(eq(shopRewards.id, input.rewardId), eq(shopRewards.familyId, familyId), eq(shopRewards.active, true)));
    if (!reward) throw notFound('Không tìm thấy món quà');
    const { balance } = await getCoinBalance(tx, familyId);
    if (balance < reward.cost) throw new ApiError(409, 'not_enough_coins', `Con cần thêm ${reward.cost - balance} xu nữa nhé!`);
    await tx.insert(redemptions).values({
      id: input.redemptionId,
      familyId,
      rewardId: reward.id,
      name: reward.name,
      cost: reward.cost,
      redeemedAt: now,
    });
  });
  return getShop(db, familyId);
}

export async function addShopReward(db: Database, familyId: string, input: { name: string; cost: number }): Promise<ShopView> {
  const [n] = await db
    .select({ n: count() })
    .from(shopRewards)
    .where(and(eq(shopRewards.familyId, familyId), eq(shopRewards.active, true)));
  if ((n?.n ?? 0) >= MAX_SHOP_REWARDS) throw conflict(`Tối đa ${MAX_SHOP_REWARDS} món quà`);
  await db.insert(shopRewards).values({ familyId, name: input.name, cost: input.cost });
  return getShop(db, familyId);
}

/** Bỏ một món quà (ẩn đi, lịch sử đổi quà vẫn giữ tên). */
export async function removeShopReward(db: Database, familyId: string, rewardId: string): Promise<ShopView> {
  const r = await db
    .update(shopRewards)
    .set({ active: false })
    .where(and(eq(shopRewards.id, rewardId), eq(shopRewards.familyId, familyId)))
    .returning({ id: shopRewards.id });
  if (!r.length) throw notFound('Không tìm thấy món quà');
  return getShop(db, familyId);
}

/** Bố mẹ đánh dấu đã trao quà. */
export async function markDelivered(db: Database, familyId: string, redemptionId: string, now = new Date()): Promise<ShopView> {
  const r = await db
    .update(redemptions)
    .set({ deliveredAt: now })
    .where(and(eq(redemptions.id, redemptionId), eq(redemptions.familyId, familyId), isNull(redemptions.deliveredAt)))
    .returning({ id: redemptions.id });
  if (!r.length) throw notFound('Không tìm thấy lượt đổi quà');
  return getShop(db, familyId);
}

// ---------- Bảng xếp hạng ----------

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

/** Xếp hạng các gia đình theo số xu KIẾM được (tuần này / mọi lúc). Chỉ hiện tên gia đình. */
export async function getLeaderboard(db: Database, familyId: string, now = new Date()): Promise<Leaderboard> {
  const start = weekStart(now);
  const sum = sql<number>`sum(${coinLedger.amount})::int`;
  const week = await db
    .select({ familyId: coinLedger.familyId, coins: sum })
    .from(coinLedger)
    .where(gte(coinLedger.earnedAt, start))
    .groupBy(coinLedger.familyId);
  const all = await db.select({ familyId: coinLedger.familyId, coins: sum }).from(coinLedger).groupBy(coinLedger.familyId);
  const ids = [...new Set([familyId, ...week.map((w) => w.familyId), ...all.map((a) => a.familyId)])];
  const names = new Map((await db.select({ id: families.id, name: families.name }).from(families).where(inArray(families.id, ids))).map((f) => [f.id, f.name]));
  const rank = (rows: { familyId: string; coins: number }[]): LeaderboardRow[] => {
    const list = rows.map((r) => ({ familyId: r.familyId, coins: Number(r.coins) }));
    if (!list.some((r) => r.familyId === familyId)) list.push({ familyId, coins: 0 });
    list.sort((a, b) => b.coins - a.coins || (names.get(a.familyId) ?? '').localeCompare(names.get(b.familyId) ?? ''));
    let lastCoins = -1;
    let lastRank = 0;
    return list.map((r, i) => {
      if (r.coins !== lastCoins) {
        lastRank = i + 1;
        lastCoins = r.coins;
      }
      return { rank: lastRank, name: names.get(r.familyId) ?? 'Gia đình', coins: r.coins, me: r.familyId === familyId };
    });
  };
  return {
    weekStart: start.toISOString(),
    weekEnd: new Date(start.getTime() + 7 * 24 * 3600_000).toISOString(),
    week: rank(week),
    allTime: rank(all),
  };
}

// ---------- Tổng quan cho trang chủ ----------

export interface PrimaryOverview {
  coins: CoinBalance;
  reviewCount: number;
  challengeBest: number;
  weekRank: number;
  weekCoins: number;
  families: number;
}

export async function getPrimaryOverview(db: Database, familyId: string, now = new Date()): Promise<PrimaryOverview> {
  const [coins, reviewCount, best, board] = await Promise.all([
    getCoinBalance(db, familyId),
    countReviewItems(db, familyId),
    db
      .select({ n: sql<number>`coalesce(max(${challengeRuns.correct}), 0)::int` })
      .from(challengeRuns)
      .where(and(eq(challengeRuns.familyId, familyId), sql`${challengeRuns.completedAt} is not null`)),
    getLeaderboard(db, familyId, now),
  ]);
  const me = board.week.find((r) => r.me)!;
  return {
    coins,
    reviewCount,
    challengeBest: Number(best[0]?.n ?? 0),
    weekRank: me.rank,
    weekCoins: me.coins,
    families: board.week.length,
  };
}
