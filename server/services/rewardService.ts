import { desc, eq, sql } from 'drizzle-orm';
import { giftOpenings, progress, rewards } from '../../db/schema.js';
import { candiesUntilNextGift, giftsAvailable, pickGiftSticker } from '../../src/engine/RewardService.js';
import type { Rng } from '../../src/engine/types.js';
import type { Database } from '../db.js';
import { conflict } from '../errors.js';
import { ensureProgressRow, getStickerCounts, type StickerCount } from './progressService.js';

export interface RewardsOverview {
  totalCandies: number;
  giftsOpened: number;
  giftsAvailable: number;
  candiesUntilNextGift: number;
  stickers: StickerCount[];
  recent: { rewardType: string; rewardCode: string; quantity: number; earnedAt: string }[];
}

export async function getRewardsOverview(db: Database): Promise<RewardsOverview> {
  const p = await ensureProgressRow(db);
  const stickers = await getStickerCounts(db);
  const recent = await db
    .select({
      rewardType: rewards.rewardType,
      rewardCode: rewards.rewardCode,
      quantity: rewards.quantity,
      earnedAt: rewards.earnedAt,
    })
    .from(rewards)
    .orderBy(desc(rewards.earnedAt), desc(rewards.id))
    .limit(10);
  return {
    totalCandies: p.totalCandies,
    giftsOpened: p.giftsOpened,
    giftsAvailable: giftsAvailable(p.totalCandies, p.giftsOpened),
    candiesUntilNextGift: candiesUntilNextGift(p.totalCandies, p.giftsOpened),
    stickers,
    recent: recent.map((r) => ({ ...r, earnedAt: r.earnedAt.toISOString() })),
  };
}

export interface GiftResult {
  giftId: string;
  stickerCode: string;
  isNewSticker: boolean;
  alreadyOpened: boolean;
  giftsAvailable: number;
}

/**
 * Mở hộp quà. `giftId` do client sinh (UUID) cho mỗi lần bấm mở:
 * gọi lặp cùng giftId => trả về đúng phần quà cũ, không mở thêm hộp.
 */
export async function openGift(db: Database, giftId: string, rng: Rng = Math.random): Promise<GiftResult> {
  return db.transaction(async (tx) => {
    const p = await ensureProgressRow(tx, true);
    const [existing] = await tx.select().from(giftOpenings).where(eq(giftOpenings.id, giftId));
    if (existing) {
      return {
        giftId,
        stickerCode: existing.stickerCode,
        isNewSticker: false,
        alreadyOpened: true,
        giftsAvailable: giftsAvailable(p.totalCandies, p.giftsOpened),
      };
    }
    if (giftsAvailable(p.totalCandies, p.giftsOpened) <= 0) {
      throw conflict('Bé cần thêm kẹo để mở hộp quà nhé!');
    }
    const owned = await tx
      .selectDistinct({ code: rewards.rewardCode })
      .from(rewards)
      .where(eq(rewards.rewardType, 'sticker'));
    const ownedCodes = owned.map((o) => o.code);
    const stickerCode = pickGiftSticker(ownedCodes, rng);

    await tx.insert(giftOpenings).values({ id: giftId, stickerCode });
    await tx.insert(rewards).values({
      rewardType: 'sticker',
      rewardCode: stickerCode,
      quantity: 1,
      sourceGiftId: giftId,
      dedupeKey: `gift:${giftId}`,
    });
    const [updated] = await tx
      .update(progress)
      .set({ giftsOpened: sql`${progress.giftsOpened} + 1`, updatedAt: new Date() })
      .where(eq(progress.id, 1))
      .returning();
    return {
      giftId,
      stickerCode,
      isNewSticker: !ownedCodes.includes(stickerCode),
      alreadyOpened: false,
      giftsAvailable: giftsAvailable(updated!.totalCandies, updated!.giftsOpened),
    };
  });
}
