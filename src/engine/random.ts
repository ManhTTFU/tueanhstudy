import type { Rng } from './types.js';

/** RNG mặc định. */
export const defaultRng: Rng = Math.random;

/** RNG có seed (mulberry32) – dùng cho kiểm thử để kết quả lặp lại được. */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Số nguyên ngẫu nhiên trong [min, max]. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Xáo trộn Fisher–Yates (trả về mảng mới). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}

/** Lấy ngẫu nhiên `count` phần tử không trùng. */
export function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  if (count > items.length) {
    throw new Error(`Không thể lấy ${count} phần tử từ danh sách ${items.length} phần tử`);
  }
  return shuffle(items, rng).slice(0, count);
}

export function pickOne<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('Danh sách rỗng');
  return items[Math.floor(rng() * items.length)] as T;
}

export function rangeArray(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}
