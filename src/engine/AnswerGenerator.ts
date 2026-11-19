import { rangeArray, shuffle } from './random.js';
import type { NumberRange, Rng } from './types.js';

export interface NumericOptionsInput {
  correct: number;
  range: NumberRange;
  count: number;
  rng: Rng;
  /**
   * Tỷ lệ phương án nhiễu "gần" đáp án đúng (±3). Đáp án gần giúp bé
   * thực sự phải đếm/nhận biết thay vì đoán theo độ lớn.
   */
  nearRatio?: number;
}

/**
 * Sinh `count` phương án số nguyên:
 *  - Luôn chứa đáp án đúng đúng 1 lần.
 *  - Không trùng nhau.
 *  - Nằm trong phạm vi kiến thức của chương.
 *  - Đã được xáo trộn vị trí.
 */
export function generateNumericOptions({
  correct,
  range,
  count,
  rng,
  nearRatio = 0.5,
}: NumericOptionsInput): number[] {
  if (correct < range.min || correct > range.max) {
    throw new Error(`Đáp án ${correct} nằm ngoài phạm vi ${range.min}–${range.max}`);
  }
  const pool = rangeArray(range.min, range.max).filter((n) => n !== correct);
  if (pool.length < count - 1) {
    throw new Error('Phạm vi quá nhỏ để sinh đủ phương án');
  }
  const near = shuffle(
    pool.filter((n) => Math.abs(n - correct) <= 3),
    rng,
  );
  const far = shuffle(
    pool.filter((n) => Math.abs(n - correct) > 3),
    rng,
  );
  const wanted = count - 1;
  const nearCount = Math.min(near.length, Math.round(wanted * nearRatio));
  const distractors = [...near.slice(0, nearCount), ...far.slice(0, wanted - nearCount)];
  // Bù thêm nếu nhóm "xa" không đủ.
  const leftovers = [...near.slice(nearCount), ...far.slice(wanted - nearCount)];
  while (distractors.length < wanted) {
    const next = leftovers.shift();
    if (next === undefined) break;
    distractors.push(next);
  }
  return shuffle([correct, ...distractors], rng);
}

/** Kiểm tra tính hợp lệ của bộ phương án (dùng ở server và kiểm thử). */
export function areOptionsValid(options: readonly number[], correct: number, count: number): boolean {
  return (
    options.length === count &&
    new Set(options).size === options.length &&
    options.filter((o) => o === correct).length === 1
  );
}
