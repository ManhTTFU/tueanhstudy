import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, mix, numberQ, Q, type Visual } from '../kit.js';
import type { Topic } from '../topic.js';

export const COLORS = [
  { n: 'đỏ', c: '#EF3B3B' },
  { n: 'vàng', c: '#FFC928' },
  { n: 'xanh lá', c: '#35B85A' },
  { n: 'xanh dương', c: '#2F80ED' },
  { n: 'cam', c: '#FF8A1F' },
  { n: 'tím', c: '#9B51E0' },
  { n: 'hồng', c: '#FF6FB1' },
];
const WHITE = { n: 'trắng', c: '#FFFFFF' };
const byName = (n: string) => [...COLORS, WHITE].find((c) => c.n === n)!;
const balloon = (c: { n: string; c: string }): Visual => ({ t: 'balloon', c: c.c, n: `bóng màu ${c.n}` });
const chip = (c: { n: string; c: string }): Visual => ({ t: 'color', c: c.c, n: c.n });

/** Tìm quả bóng đúng màu trong `k` màu. */
const findBalloon = (k: number) => (rng: () => number) => {
  const cs = sample(COLORS.slice(0, k), 4 > k ? k : 4, rng);
  const target = cs[0]!;
  const others = sample(COLORS.filter((c) => c !== target), 3, rng);
  return choiceQ(rng, `find:${target.n}`, `Quả bóng nào màu ${target.n}?`, [], balloon(target), others.map(balloon));
};

/** Đếm bóng cùng màu trong một chùm. */
const countBalloons = (rng: () => number) => {
  const cs = sample(COLORS, 3, rng);
  const target = cs[0]!;
  const n = randomInt(rng, 2, 5);
  const cells = shuffle([...Array.from({ length: n }, () => target), ...Array.from({ length: randomInt(rng, 3, 5) }, (_, i) => cs[1 + (i % 2)]!)], rng);
  return numberQ(rng, `count:${target.n}:${n}`, `Có bao nhiêu quả bóng màu ${target.n}?`, [{ t: 'grid', cols: 4, cells: cells.map(balloon) }], n, { min: 1, max: 8 });
};

/** Quả bóng này màu gì? (chọn tên màu) */
const nameColor = (rng: () => number) => {
  const [target, ...others] = sample(COLORS, 4, rng);
  return choiceQ(rng, `name:${target!.n}`, 'Quả bóng này màu gì?', [{ t: 'row', items: [balloon(target!)], size: 'lg' }], chip(target!), others.map(chip));
};

const MIXES: [string, string, string][] = [
  ['đỏ', 'vàng', 'cam'],
  ['xanh dương', 'vàng', 'xanh lá'],
  ['đỏ', 'xanh dương', 'tím'],
  ['đỏ', 'trắng', 'hồng'],
];
const mixColors = (rng: () => number) => {
  const [a, b, r] = pickOne(MIXES, rng);
  const res = byName(r);
  const others = sample(COLORS.filter((c) => c.n !== r && c.n !== a && c.n !== b), 3, rng);
  return choiceQ(
    rng,
    `mix:${r}`,
    `Màu ${a} trộn với màu ${b} ra màu gì?`,
    [{ t: 'row', items: [chip(byName(a)), emo('➕'), chip(byName(b)), emo('🟰'), Q], size: 'md' }],
    chip(res),
    others.map(chip),
  );
};

const REAL = [
  { e: '🍌', n: 'quả chuối chín', c: 'vàng' },
  { e: '🥕', n: 'củ cà rốt', c: 'cam' },
  { e: '🍅', n: 'quả cà chua', c: 'đỏ' },
  { e: '🍆', n: 'quả cà tím', c: 'tím' },
  { e: '🥦', n: 'cây súp lơ xanh', c: 'xanh lá' },
  { e: '🍓', n: 'quả dâu tây', c: 'đỏ' },
  { e: '🍋', n: 'quả chanh vàng', c: 'vàng' },
  { e: '🍊', n: 'quả cam', c: 'cam' },
  { e: '🐸', n: 'chú ếch', c: 'xanh lá' },
  { e: '🐷', n: 'chú lợn con', c: 'hồng' },
  { e: '🌊', n: 'sóng biển', c: 'xanh dương' },
  { e: '🍇', n: 'chùm nho', c: 'tím' },
];
const realColor = (rng: () => number) => {
  const item = pickOne(REAL, rng);
  const others = sample(COLORS.filter((c) => c.n !== item.c), 3, rng);
  return choiceQ(rng, `real:${item.e}`, `${item.n[0]!.toUpperCase()}${item.n.slice(1)} có màu gì?`, [{ t: 'row', items: [emo(item.e, item.n)], size: 'lg' }], chip(byName(item.c)), others.map(chip));
};

export const colorsTopic: Topic = {
  id: 'colors',
  name: 'Màu sắc',
  icon: '🎨',
  description: 'Nhận biết, gọi tên và pha màu.',
  theme: { primary: '#F06595', soft: '#FFE3EE', strong: '#C2255C' },
  sticker: 'paintbrush',
  levels: [
    { label: '3 màu', gen: findBalloon(3) },
    { label: '5 màu', gen: mix(findBalloon(5), countBalloons) },
    { label: 'Gọi tên màu', gen: mix(nameColor, findBalloon(7)) },
    { label: 'Pha màu', gen: mix(mixColors, nameColor) },
    { label: 'Màu đồ vật', gen: realColor },
  ],
};
