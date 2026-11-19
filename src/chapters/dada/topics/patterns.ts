import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, group, nearNumbers, numberQ, Q, txt, type Block, type Visual } from '../kit.js';
import type { Topic } from '../topic.js';

const PATTERN = ['🍎', '🍌', '⭐', '🌙', '🐶', '🐱', '🔴', '🔵', '🌸', '🍀', '🚗', '🎈'];

/** Quy luật lặp: `shape` như "AAB". */
const repeat = (shapes: string[]) => (rng: () => number) => {
  const shape = pickOne(shapes, rng);
  const units = sample(PATTERN, 3, rng);
  const unit = [...shape].map((ch) => units[ch.charCodeAt(0) - 65]!);
  const len = Math.max(6, unit.length * 2);
  const full = Array.from({ length: len + 1 }, (_, i) => unit[i % unit.length]!);
  const ans = full[len]!;
  const distract = sample(PATTERN.filter((e) => e !== ans && !unit.includes(e)), 3, rng);
  const inUnit = [...new Set(unit)].filter((e) => e !== ans);
  return choiceQ(rng, `pat:${shape}:${unit.join('')}`, 'Hình tiếp theo là hình nào?', [{ t: 'row', items: [...full.slice(0, len).map((e) => emo(e)), Q], size: 'sm' }], emo(ans), [...inUnit, ...distract].slice(0, 3).map((e) => emo(e)));
};

/** Tăng dần / giảm dần: nhóm 1, 2, 3, ? */
const grow = (rng: () => number) => {
  const e = pickOne(PATTERN, rng);
  const up = rng() < 0.6;
  const start = up ? randomInt(rng, 1, 3) : randomInt(rng, 5, 7);
  const seq = [0, 1, 2].map((i) => (up ? start + i : start - i));
  const ans = up ? start + 3 : start - 3;
  const others = nearNumbers(ans, 1, 8, 3, rng);
  return choiceQ(rng, `grow:${up}:${start}:${e}`, 'Nhóm tiếp theo có mấy hình?', [{ t: 'row', items: [...seq.map((n) => group(e, n)), Q], size: 'sm' }], group(e, ans), others.map((n) => group(e, n)));
};

/** Bảng Latin n×n (mỗi hàng, mỗi cột đủ các bạn), 1 ô trống. */
function latin(n: number, rng: () => number, boxes: boolean): number[][] {
  // Dịch vòng một hàng cơ sở, sau đó xáo hàng/cột trong cùng nhóm để vẫn đúng luật.
  const base = n === 4 && boxes ? [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]] : Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r + c) % n));
  const sym = shuffle([...Array(n).keys()], rng);
  let g = base.map((row) => row.map((x) => sym[x]!));
  if (boxes) {
    const bands = shuffle([0, 1], rng);
    g = bands.flatMap((b) => shuffle([0, 1], rng).map((r) => g[b * 2 + r]!));
  } else {
    g = shuffle(g, rng);
  }
  return g;
}
const gridQ = (n: number, boxes: boolean) => (rng: () => number) => {
  const items = sample(PATTERN, n, rng);
  const g = latin(n, rng, boxes);
  const flat = g.flat();
  const hole = randomInt(rng, 0, flat.length - 1);
  const ans = items[flat[hole]!]!;
  const cells: Visual[] = flat.map((x, i) => (i === hole ? Q : emo(items[x]!)));
  const others = [...items.filter((e) => e !== ans), ...sample(PATTERN.filter((e) => !items.includes(e)), 3, rng)].slice(0, 3);
  const blocks: Block[] = [{ t: 'grid', cols: n, cells, size: n === 4 ? 'sm' : 'md' }];
  return choiceQ(rng, `grid:${n}:${flat.join('')}:${hole}`, n === 4 ? 'Ô trống là hình nào? Mỗi hàng, mỗi cột, mỗi ô vuông nhỏ đủ 4 bạn.' : 'Ô trống là hình nào? Mỗi hàng, mỗi cột đủ 3 bạn.', blocks, emo(ans), others.map((e) => emo(e)));
};

const numSeq = (rng: () => number) => {
  const step = pickOne([1, 2, -1, 5], rng);
  const start = step > 0 ? randomInt(rng, 1, step === 5 ? 5 : 6) : randomInt(rng, 6, 10);
  const seq = [0, 1, 2, 3].map((i) => start + i * step);
  return numberQ(rng, `seq:${start}:${step}`, 'Số tiếp theo là số mấy?', [{ t: 'row', items: [...seq.map((x) => txt(String(x))), Q], size: 'md' }], start + 4 * step, { min: 0, max: 30 });
};

export const patternsTopic: Topic = {
  id: 'patterns',
  name: 'Quy luật',
  icon: '🧩',
  description: 'Quy luật lặp, tăng dần, bảng hình, sudoku hình.',
  theme: { primary: '#FF6B6B', soft: '#FFE3E3', strong: '#C92A2A' },
  sticker: 'bricks',
  levels: [
    { label: 'AB, AAB, ABB', gen: repeat(['AB', 'AAB', 'ABB']) },
    { label: 'ABC, AABB', gen: repeat(['ABC', 'AABB']) },
    { label: 'Tăng dần, giảm dần', gen: grow },
    { label: 'Bảng 3×3', gen: gridQ(3, false) },
    { label: 'Sudoku hình 4×4', gen: gridQ(4, true) },
    { label: 'Dãy số', gen: (rng, i) => (i % 3 === 2 ? gridQ(4, true)(rng) : numSeq(rng)) },
  ],
};

/** Kiểm tra bảng có đúng luật (dùng cho kiểm thử). */
export { latin as latinSquare };
