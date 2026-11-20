import { pickOne } from './random.js';
import type { AgeGroup, Rng } from './types.js';

export const PRAISES = ['Giỏi quá!', 'Chính xác rồi!', 'Bé thật thông minh!', 'Tuyệt vời!'] as const;
export type Praise = (typeof PRAISES)[number];

export const TRY_AGAIN_MESSAGE = 'Không sao, bé thử lại nhé!';
export const PERFECT_MESSAGE = 'HOAN HÔ! BÉ ĐÃ HOÀN THÀNH XUẤT SẮC!';

export function randomPraise(rng: Rng = Math.random): Praise {
  return pickOne(PRAISES, rng);
}

/** Lời động viên luôn tích cực, không tạo cảm giác thất bại. */
export function encouragementFor(score: number, maxScore = 10): string {
  if (score >= maxScore) return PERFECT_MESSAGE;
  if (score >= maxScore * 0.8) return 'Bé giỏi lắm! Sắp được 10 điểm rồi đó!';
  if (score >= maxScore * 0.5) return 'Bé làm tốt lắm! Mình chơi thêm lần nữa nhé!';
  return 'Bé đã rất cố gắng! Cùng luyện tập thêm nhé!';
}

// ---------- Nhóm 5–9 tuổi: khen theo cách làm bài, gọi bé là "con" ----------
export const PRIMARY_PRAISES = ['Chính xác!', 'Đúng rồi!', 'Làm tốt lắm!', 'Nghĩ hay lắm!', 'Tính nhanh quá!', 'Tuyệt vời!'] as const;
export const PRIMARY_TRY_AGAIN = 'Chưa đúng, con thử lại nhé!';
export const PRIMARY_PERFECT = 'XUẤT SẮC! CON LÀM ĐÚNG HẾT RỒI!';

export function primaryEncouragement(score: number, maxScore = 10): string {
  if (score >= maxScore) return PRIMARY_PERFECT;
  if (score >= maxScore * 0.8) return 'Làm tốt lắm! Chỉ còn chút nữa là đúng hết!';
  if (score >= maxScore * 0.5) return 'Khá lắm! Luyện thêm một lượt nữa nhé!';
  return 'Con đã cố gắng rồi! Xem gợi ý từng bước rồi thử lại nhé!';
}

/** Bộ lời nói theo nhóm tuổi. */
export interface MessageSet {
  praises: readonly string[];
  tryAgain: string;
  perfect: string;
  encouragement: (score: number, maxScore?: number) => string;
}

export function messagesFor(ageGroup: AgeGroup = 'preschool'): MessageSet {
  return ageGroup === 'primary'
    ? { praises: PRIMARY_PRAISES, tryAgain: PRIMARY_TRY_AGAIN, perfect: PRIMARY_PERFECT, encouragement: primaryEncouragement }
    : { praises: PRAISES, tryAgain: TRY_AGAIN_MESSAGE, perfect: PERFECT_MESSAGE, encouragement: encouragementFor };
}
