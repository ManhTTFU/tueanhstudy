import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { numberWord } from '../../../data/numbers/numbers.js';
import { emo, numberQ, type Named } from '../kit.js';
import type { Topic } from '../topic.js';

export const COUNT_OBJS: Named[] = [
  { e: '🐟', n: 'con cá' },
  { e: '🍎', n: 'quả táo' },
  { e: '🐤', n: 'chú gà con' },
  { e: '⭐', n: 'ngôi sao' },
  { e: '🚗', n: 'chiếc ô tô' },
  { e: '🎈', n: 'quả bóng' },
  { e: '🐞', n: 'con bọ rùa' },
  { e: '🌸', n: 'bông hoa' },
  { e: '🦋', n: 'con bướm' },
  { e: '🍓', n: 'quả dâu' },
];

const count = (min: number, max: number, strangers: boolean) => (rng: () => number) => {
  const [obj, other] = sample(COUNT_OBJS, 2, rng);
  const n = randomInt(rng, min, max);
  const extra = strangers ? randomInt(rng, 1, 3) : 0;
  const cells = shuffle([...Array.from({ length: n }, () => emo(obj!.e)), ...Array.from({ length: extra }, () => emo(other!.e))], rng);
  return numberQ(rng, `count:${obj!.e}:${n}`, `Có bao nhiêu ${obj!.n}?`, [{ t: 'grid', cols: n + extra > 9 ? 5 : 4, cells, size: n + extra > 9 ? 'sm' : 'md' }], n, { min: Math.max(1, min - 2), max: max + 2 });
};

/** Đếm rồi thêm 1. */
const plusOne = (rng: () => number) => {
  const obj = pickOne(COUNT_OBJS, rng);
  const n = randomInt(rng, 3, 9);
  return numberQ(
    rng,
    `plus1:${obj.e}:${n}`,
    `Có ${n} ${obj.n}, thêm 1 nữa là mấy?`,
    [{ t: 'row', items: [...Array.from({ length: n }, () => emo(obj.e)), emo('➕'), emo(obj.e)], size: 'sm' }],
    n + 1,
    { min: 1, max: 10 },
    `Có ${numberWord(n).toLowerCase()} ${obj.n}, thêm một nữa là mấy?`,
  );
};

export const countingTopic: Topic = {
  id: 'counting',
  name: 'Đếm số',
  icon: '🔢',
  description: 'Đếm từ 1 đến 15, có bạn lạ xen vào.',
  theme: { primary: '#339AF0', soft: '#DDF3FF', strong: '#1864AB' },
  sticker: 'hundred-points',
  levels: [
    { label: 'Đếm 1–5', gen: count(1, 5, false) },
    { label: 'Đếm 1–7, có bạn lạ', gen: count(1, 7, true) },
    { label: 'Thêm 1 là mấy', gen: plusOne },
    { label: 'Đếm 8–15', gen: count(8, 15, false) },
  ],
};
