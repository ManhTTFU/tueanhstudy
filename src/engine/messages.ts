import { pickOne } from './random.js';
import type { Rng } from './types.js';

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
