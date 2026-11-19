/**
 * RewardService – quy tắc trao thưởng THUẦN. Server gọi trong transaction,
 * mỗi phần thưởng có `dedupeKey` riêng để database chặn cộng trùng.
 */
import { ACHIEVEMENTS, PERFECT_STREAK_ACHIEVEMENTS, REWARD_CONFIG } from '../config/rewards.js';
import { GIFT_STICKER_CODES } from '../data/stickers.js';
import { pickOne } from './random.js';
import type { ChapterRewardConfig, QuizScore, RewardGrant, Rng } from './types.js';

export interface SessionRewardInput {
  sessionId: string;
  chapterId: string;
  chapterRewards: ChapterRewardConfig;
  score: Pick<QuizScore, 'isPerfectScore'>;
  /** Số bài đã hoàn thành TÍNH CẢ bài này. */
  completedQuizzesAfter: number;
  /** Số bài 10/10 (mọi chương) TÍNH CẢ bài này. */
  perfectSessionsAfter: number;
}

export function computeSessionRewards(input: SessionRewardInput): RewardGrant[] {
  const grants: RewardGrant[] = [];
  const { sessionId, chapterId, chapterRewards, score } = input;

  if (score.isPerfectScore && chapterRewards.candiesForPerfect > 0) {
    grants.push({
      rewardType: 'candy',
      rewardCode: 'candy',
      quantity: chapterRewards.candiesForPerfect,
      dedupeKey: `session:${sessionId}:candy`,
      reason: 'Đạt 10/10',
    });
  }

  if (score.isPerfectScore && chapterRewards.firstPerfectSticker) {
    grants.push({
      rewardType: 'sticker',
      rewardCode: chapterRewards.firstPerfectSticker,
      quantity: 1,
      dedupeKey: `achievement:first-perfect:${chapterId}`,
      reason: 'Lần đầu đạt 10/10 ở chương này',
    });
  }

  for (const a of ACHIEVEMENTS) {
    if (input.completedQuizzesAfter >= a.completedQuizzes) {
      grants.push({
        rewardType: 'sticker',
        rewardCode: a.sticker,
        quantity: 1,
        dedupeKey: `achievement:${a.code}`,
        reason: a.reason,
      });
    }
  }

  for (const a of PERFECT_STREAK_ACHIEVEMENTS) {
    if (input.perfectSessionsAfter >= a.perfectSessions) {
      grants.push({
        rewardType: 'sticker',
        rewardCode: a.sticker,
        quantity: 1,
        dedupeKey: `achievement:${a.code}`,
        reason: a.reason,
      });
    }
  }

  return grants;
}

/** Số hộp quà bé đang có thể mở. Kẹo được TÍCH LUỸ, không bị trừ khi mở quà. */
export function giftsAvailable(
  totalCandies: number,
  giftsOpened: number,
  candiesPerGift: number = REWARD_CONFIG.candiesPerGift,
): number {
  return Math.max(0, Math.floor(totalCandies / candiesPerGift) - giftsOpened);
}

/** Số kẹo còn thiếu để mở hộp quà tiếp theo. */
export function candiesUntilNextGift(
  totalCandies: number,
  giftsOpened: number,
  candiesPerGift: number = REWARD_CONFIG.candiesPerGift,
): number {
  if (giftsAvailable(totalCandies, giftsOpened, candiesPerGift) > 0) return 0;
  return (giftsOpened + 1) * candiesPerGift - totalCandies;
}

/** Ưu tiên sticker bé chưa có; nếu đã đủ bộ thì chọn ngẫu nhiên bất kỳ. */
export function pickGiftSticker(
  ownedCodes: Iterable<string>,
  rng: Rng = Math.random,
  pool: readonly string[] = GIFT_STICKER_CODES,
): string {
  const owned = new Set(ownedCodes);
  const notOwned = pool.filter((c) => !owned.has(c));
  return pickOne(notOwned.length > 0 ? notOwned : pool, rng);
}
