import { numberWord } from '../../../data/numbers/numbers.js';
import { pickOne, randomInt, sample } from '../../../engine/random.js';
import { choiceQ, emo, group, nearNumbers, numberQ, Q, txt } from '../kit.js';
import type { Topic } from '../topic.js';
import { COUNT_OBJS } from './counting.js';

const w = (n: number) => numberWord(n).toLowerCase();

/** Nhìn số, chọn đĩa có đúng số lượng. */
const numToSet = (rng: () => number) => {
  const n = randomInt(rng, 1, 10);
  const obj = pickOne(COUNT_OBJS, rng);
  const others = nearNumbers(n, 1, 10, 3, rng);
  return choiceQ(rng, `set:${n}`, `Đĩa nào có ${n} ${obj.n}?`, [{ t: 'row', items: [txt(String(n))], size: 'lg' }], group(obj.e, n), others.map((x) => group(obj.e, x)), `Đĩa nào có ${w(n)} ${obj.n}?`);
};

const compareNums = (rng: () => number) => {
  const nums = sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, rng);
  const biggest = rng() < 0.5;
  const ans = biggest ? Math.max(...nums) : Math.min(...nums);
  return choiceQ(rng, `cmp:${biggest}:${ans}`, biggest ? 'Số nào lớn nhất?' : 'Số nào bé nhất?', [], txt(String(ans)), nums.filter((x) => x !== ans).map((x) => txt(String(x))));
};

const missingNum = (rng: () => number) => {
  const start = randomInt(rng, 1, 7);
  const hole = randomInt(rng, 1, 3);
  const seq = [start, start + 1, start + 2, start + 3];
  return numberQ(rng, `miss:${start}:${hole}`, 'Số nào còn thiếu?', [{ t: 'row', items: seq.map((x, i) => (i === hole ? Q : txt(String(x)))), size: 'md' }], seq[hole]!, { min: 1, max: 10 });
};

const addPic = (rng: () => number) => {
  const obj = pickOne(COUNT_OBJS, rng);
  const a = randomInt(rng, 1, 4);
  const b = randomInt(rng, 1, 5 - a);
  return numberQ(rng, `add:${a}:${b}`, `${a} + ${b} = ?`, [{ t: 'row', items: [group(obj.e, a), emo('➕'), group(obj.e, b)], size: 'sm' }], a + b, { min: 1, max: 6 }, `${numberWord(a)} cộng ${w(b)} bằng mấy?`);
};

const subPic = (rng: () => number) => {
  const obj = pickOne(COUNT_OBJS, rng);
  const a = randomInt(rng, 3, 10);
  const b = randomInt(rng, 1, a - 1);
  return numberQ(rng, `sub:${a}:${b}`, `${a} − ${b} = ?`, [{ t: 'row', items: [group(obj.e, a), emo('➖'), txt(String(b))], size: 'sm' }], a - b, { min: 0, max: 10 }, `${numberWord(a)} trừ ${w(b)} bằng mấy?`);
};

const STORIES = [
  { e: '🍎', n: 'quả táo', add: (a: number, b: number) => `Bé có ${a} quả táo, mẹ cho thêm ${b} quả. Bé có tất cả mấy quả?` },
  { e: '🐤', n: 'chú gà', add: (a: number, b: number) => `Có ${a} chú gà, ${b} chú nữa chạy tới. Có tất cả mấy chú gà?` },
  { e: '🎈', n: 'quả bóng', sub: (a: number, b: number) => `Bé có ${a} quả bóng, bay mất ${b} quả. Bé còn mấy quả bóng?` },
  { e: '🍪', n: 'cái bánh', sub: (a: number, b: number) => `Có ${a} cái bánh, bé ăn ${b} cái. Còn lại mấy cái bánh?` },
];
const wordProblem = (rng: () => number) => {
  const s = pickOne(STORIES, rng);
  if (rng() < 0.25) {
    const total = randomInt(rng, 3, 10);
    const part = randomInt(rng, 1, total - 1);
    return numberQ(rng, `split:${total}:${part}`, `${total} gồm ${part} và mấy?`, [{ t: 'row', items: [group('🔵', part), emo('➕'), Q], size: 'sm' }], total - part, { min: 0, max: 10 }, `${numberWord(total)} gồm ${w(part)} và mấy?`);
  }
  if (s.add) {
    const a = randomInt(rng, 1, 6);
    const b = randomInt(rng, 1, Math.min(4, 10 - a));
    const text = s.add(a, b);
    return numberQ(rng, `word:${s.e}:${a}:${b}`, text, [{ t: 'row', items: [group(s.e, a), emo('➕'), group(s.e, b)], size: 'sm' }], a + b, { min: 1, max: 10 }, s.add(a, b).replace(/\d+/g, (d) => w(Number(d))));
  }
  const a = randomInt(rng, 3, 9);
  const b = randomInt(rng, 1, a - 1);
  const text = s.sub!(a, b);
  return numberQ(rng, `word:${s.e}:${a}:${b}`, text, [{ t: 'row', items: [group(s.e, a)], size: 'sm' }], a - b, { min: 0, max: 10 }, text.replace(/\d+/g, (d) => w(Number(d))));
};

export const mathTopic: Topic = {
  id: 'math',
  name: 'Toán vui',
  icon: '➕',
  description: 'Số và lượng, lớn bé, số còn thiếu, toán có lời.',
  theme: { primary: '#20C997', soft: '#DDF8F1', strong: '#087F5B' },
  sticker: 'input-numbers',
  levels: [
    { label: 'Chọn đĩa đúng số', gen: numToSet },
    { label: 'Lớn nhất, bé nhất', gen: compareNums },
    { label: 'Số còn thiếu', gen: missingNum },
    { label: 'Cộng bằng hình', gen: addPic },
    { label: 'Trừ bằng hình', gen: subPic },
    { label: 'Toán có lời', gen: wordProblem },
  ],
};
