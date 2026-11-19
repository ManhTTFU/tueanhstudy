import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, group, numberQ, type Named, type Visual } from '../kit.js';
import type { Topic } from '../topic.js';
import { COUNT_OBJS } from './counting.js';

const ANIMALS: Named[] = [
  { e: '🐘', n: 'voi' },
  { e: '🐻', n: 'gấu' },
  { e: '🐔', n: 'gà' },
  { e: '🐢', n: 'rùa' },
  { e: '🐶', n: 'cún' },
  { e: '🐸', n: 'ếch' },
  { e: '🐰', n: 'thỏ' },
];
const SIZES = [0.6, 1, 1.45];
const sized = (a: Named, i: number, label: string): Visual => emo(a.e, `${a.n} ${label}`, SIZES[i]);

const bigSmall = (rng: () => number) => {
  const a = pickOne(ANIMALS, rng);
  const big = rng() < 0.5;
  return choiceQ(rng, `bs:${a.e}:${big}`, big ? `Bạn ${a.n} nào to hơn?` : `Bạn ${a.n} nào nhỏ hơn?`, [], sized(a, big ? 2 : 0, big ? 'to' : 'nhỏ'), [sized(a, big ? 0 : 2, big ? 'nhỏ' : 'to')]);
};

const moreLess = (rng: () => number) => {
  const o = pickOne(COUNT_OBJS, rng);
  const [x, y] = sample([1, 2, 3, 4, 5, 6], 2, rng);
  const more = rng() < 0.5;
  const ans = more ? Math.max(x!, y!) : Math.min(x!, y!);
  const other = ans === x ? y! : x!;
  return choiceQ(rng, `ml:${more}:${x}:${y}`, more ? 'Đĩa nào nhiều hơn?' : 'Đĩa nào ít hơn?', [], group(o.e, ans), [group(o.e, other)]);
};

const biggestOf3 = (rng: () => number) => {
  const a = pickOne(ANIMALS, rng);
  const big = rng() < 0.5;
  const correct = sized(a, big ? 2 : 0, big ? 'to nhất' : 'nhỏ nhất');
  return choiceQ(rng, `b3:${a.e}:${big}`, big ? `Bạn ${a.n} nào to nhất?` : `Bạn ${a.n} nào nhỏ nhất?`, [], correct, [sized(a, 1, 'vừa'), sized(a, big ? 0 : 2, big ? 'nhỏ nhất' : 'to nhất')]);
};

const mostLeast = (rng: () => number) => {
  const o = pickOne(COUNT_OBJS, rng);
  const nums = sample([1, 2, 3, 4, 5, 6, 7], 3, rng);
  const most = rng() < 0.5;
  const ans = most ? Math.max(...nums) : Math.min(...nums);
  return choiceQ(rng, `mm:${most}:${nums.join()}`, most ? 'Đĩa nào nhiều nhất?' : 'Đĩa nào ít nhất?', [], group(o.e, ans), nums.filter((n) => n !== ans).map((n) => group(o.e, n)));
};

/** Xếp từ bé đến lớn: chọn hàng xếp đúng. */
const sortSize = (rng: () => number) => {
  const a = pickOne(ANIMALS, rng);
  const row = (order: number[]): Visual => ({ t: 'row', items: order.map((i) => emo(a.e, undefined, SIZES[i])), n: order.map((i) => ['nhỏ', 'vừa', 'to'][i]).join(' – ') });
  const wrong = shuffle([[2, 1, 0], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0]], rng).slice(0, 3);
  return choiceQ(rng, `sort:${a.e}`, 'Hàng nào xếp từ bé đến lớn?', [], row([0, 1, 2]), wrong.map(row));
};

const KNOW = [
  { q: 'Con nào nặng hơn?', a: { e: '🐘', n: 'voi' }, b: { e: '🐭', n: 'chuột' } },
  { q: 'Con nào chạy nhanh hơn?', a: { e: '🐆', n: 'báo' }, b: { e: '🐢', n: 'rùa' } },
  { q: 'Con nào cao hơn?', a: { e: '🦒', n: 'hươu cao cổ' }, b: { e: '🐇', n: 'thỏ' } },
  { q: 'Cái nào nhẹ hơn?', a: { e: '🪶', n: 'lông chim' }, b: { e: '🪨', n: 'hòn đá' } },
  { q: 'Cái nào chạy nhanh hơn?', a: { e: '✈️', n: 'máy bay' }, b: { e: '🚲', n: 'xe đạp' } },
  { q: 'Cái nào nóng hơn?', a: { e: '☀️', n: 'mặt trời' }, b: { e: '🧊', n: 'đá lạnh' } },
  { q: 'Con nào bé hơn?', a: { e: '🐜', n: 'kiến' }, b: { e: '🐄', n: 'bò' } },
];
const knowCompare = (rng: () => number) => {
  const k = pickOne(KNOW, rng);
  return choiceQ(rng, `know:${k.q}`, k.q, [], emo(k.a.e, k.a.n), [emo(k.b.e, k.b.n)]);
};

const howMany = (rng: () => number) => {
  const [o1, o2] = sample(COUNT_OBJS, 2, rng);
  const x = randomInt(rng, 3, 7);
  const y = randomInt(rng, 1, x - 1);
  return numberQ(
    rng,
    `hm:${x}:${y}`,
    `${o1!.n[0]!.toUpperCase()}${o1!.n.slice(1)} nhiều hơn ${o2!.n} mấy?`,
    [
      { t: 'row', items: Array.from({ length: x }, () => emo(o1!.e)), size: 'sm' },
      { t: 'row', items: Array.from({ length: y }, () => emo(o2!.e)), size: 'sm' },
    ],
    x - y,
    { min: 1, max: 6 },
  );
};

export const compareTopic: Topic = {
  id: 'compare',
  name: 'So sánh',
  icon: '⚖️',
  description: 'To – nhỏ, nhiều – ít, xếp thứ tự.',
  theme: { primary: '#51CF66', soft: '#E6F9EA', strong: '#2B8A3E' },
  sticker: 'balance-scale',
  levels: [
    { label: 'To – nhỏ, nhiều – ít', gen: (rng, i) => (i % 2 ? moreLess(rng) : bigSmall(rng)) },
    { label: 'To nhất, nhỏ nhất', gen: biggestOf3 },
    { label: 'Nhiều nhất, ít nhất', gen: mostLeast },
    { label: 'Xếp từ bé đến lớn', gen: sortSize },
    { label: 'Nặng – nhẹ, nhanh – chậm', gen: knowCompare },
    { label: 'Nhiều hơn mấy?', gen: howMany },
  ],
};
