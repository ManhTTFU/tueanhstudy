import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, mix, numberQ, type ShapeId, type Visual } from '../kit.js';
import type { Topic } from '../topic.js';
import { COLORS } from './colors.js';

export const SHAPES: { s: ShapeId; n: string }[] = [
  { s: 'circle', n: 'hình tròn' },
  { s: 'square', n: 'hình vuông' },
  { s: 'triangle', n: 'hình tam giác' },
  { s: 'rect', n: 'hình chữ nhật' },
  { s: 'star', n: 'ngôi sao' },
  { s: 'heart', n: 'trái tim' },
];
const shape = (s: { s: ShapeId; n: string }, c: string, colorName?: string): Visual => ({ t: 'shape', s: s.s, c, n: colorName ? `${s.n} màu ${colorName}` : s.n });
const rc = (rng: () => number) => pickOne(COLORS, rng);

const findShape = (k: number) => (rng: () => number) => {
  const [target, ...others] = sample(SHAPES.slice(0, k), 4, rng);
  return choiceQ(rng, `find:${target!.s}`, `Đâu là ${target!.n}?`, [], shape(target!, rc(rng).c), others.map((o) => shape(o, rc(rng).c)));
};

/** Giống hệt cả hình và màu: nhiễu cùng hình khác màu, cùng màu khác hình. */
const sameShape = (rng: () => number) => {
  const target = pickOne(SHAPES, rng);
  const [col, col2, col3] = sample(COLORS, 3, rng);
  const [o1, o2] = sample(SHAPES.filter((x) => x !== target), 2, rng);
  return choiceQ(
    rng,
    `same:${target.s}:${col!.n}`,
    'Hình nào giống hệt hình mẫu?',
    [{ t: 'row', items: [shape(target, col!.c, col!.n)], label: 'Hình mẫu', size: 'lg' }],
    shape(target, col!.c, col!.n),
    [shape(target, col2!.c, col2!.n), shape(o1!, col!.c, col!.n), shape(o2!, col3!.c, col3!.n)],
  );
};

const PROPS: { q: string; a: ShapeId }[] = [
  { q: 'Hình nào có 3 cạnh?', a: 'triangle' },
  { q: 'Hình nào không có cạnh, không có góc?', a: 'circle' },
  { q: 'Hình nào có 4 cạnh bằng nhau?', a: 'square' },
  { q: 'Hình nào có 5 cánh?', a: 'star' },
];
const shapeProps = (rng: () => number) => {
  const p = pickOne(PROPS, rng);
  const target = SHAPES.find((s) => s.s === p.a)!;
  const others = sample(SHAPES.filter((s) => s.s !== p.a && !(p.a === 'square' && s.s === 'rect')), 3, rng);
  return choiceQ(rng, `prop:${p.a}`, p.q, [], shape(target, rc(rng).c), others.map((o) => shape(o, rc(rng).c)));
};

const SOLIDS: { n: string; items: { e: string; n: string }[] }[] = [
  { n: 'khối cầu', items: [{ e: '⚽', n: 'quả bóng' }, { e: '🏀', n: 'quả bóng rổ' }, { e: '🌍', n: 'quả địa cầu' }, { e: '🍊', n: 'quả cam' }] },
  { n: 'khối lập phương', items: [{ e: '🎲', n: 'xúc xắc' }, { e: '🧊', n: 'viên đá' }, { e: '📦', n: 'hộp quà' }] },
  { n: 'khối trụ', items: [{ e: '🥫', n: 'lon sữa' }, { e: '🔋', n: 'cục pin' }, { e: '🥁', n: 'cái trống' }] },
];
const solids = (rng: () => number) => {
  const target = pickOne(SOLIDS, rng);
  const item = pickOne(target.items, rng);
  const others = sample(SOLIDS.filter((s) => s !== target).flatMap((s) => s.items), 3, rng);
  return choiceQ(rng, `solid:${item.e}`, `Đồ vật nào có dạng ${target.n}?`, [], emo(item.e, item.n), others.map((o) => emo(o.e, o.n)));
};

const countShapes = (rng: () => number) => {
  const [target, a, b] = sample(SHAPES, 3, rng);
  const n = randomInt(rng, 2, 6);
  const cells = shuffle(
    [...Array.from({ length: n }, () => target!), ...Array.from({ length: randomInt(rng, 3, 6) }, (_, i) => (i % 2 ? a! : b!))],
    rng,
  ).map((s) => shape(s, rc(rng).c));
  return numberQ(rng, `count:${target!.s}:${n}`, `Có bao nhiêu ${target!.n}?`, [{ t: 'grid', cols: 4, cells, size: 'sm' }], n, { min: 1, max: 8 });
};

export const shapesTopic: Topic = {
  id: 'shapes',
  name: 'Hình khối',
  icon: '🔺',
  description: 'Hình tròn, vuông, tam giác và các khối.',
  theme: { primary: '#FF922B', soft: '#FFF0DB', strong: '#D9480F' },
  sticker: 'triangular-ruler',
  levels: [
    { label: '4 hình', gen: findShape(4) },
    { label: '6 hình', gen: findShape(6) },
    { label: 'Giống hệt', gen: sameShape },
    { label: 'Cạnh và góc', gen: shapeProps },
    { label: 'Khối', gen: solids },
    { label: 'Đếm hình', gen: mix(countShapes, sameShape) },
  ],
};
