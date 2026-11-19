import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, numberQ, Q, type Block, type Visual } from '../kit.js';
import type { Topic } from '../topic.js';

const ITEMS = ['🐘', '🦒', '🐢', '🐓', '🐇', '🦋', '🐟', '🚲', '☂️', '🍐', '🎸', '🦀', '🐌', '🚁', '🍉', '🧸', '🎁', '🚂', '🦕', '✈️'];
const SMALL = ['🍎', '🍌', '⭐', '🌸', '🐟', '🎈', '🍀', '🐞', '🍓', '🚗'];
const shadow = (e: string): Visual => ({ t: 'emoji', e, shadow: true, n: 'cái bóng' });

const silhouette = (rng: () => number) => {
  const [a, ...o] = sample(ITEMS, 4, rng);
  return choiceQ(rng, `sh:${a}`, 'Cái bóng này là của bạn nào?', [{ t: 'row', items: [shadow(a!)], label: 'Cái bóng', size: 'lg' }], emo(a!), o.map((e) => emo(e)));
};

/** Ghi nhớ: hiện vài hình rồi úp lại. */
const memoryShowMs = (n: number) => 1500 + 900 * n;
const remember = (count: number) => (rng: () => number) => {
  const pool = sample(ITEMS, count + 3, rng);
  const shown = pool.slice(0, count);
  const ans = pickOne(shown, rng);
  const ms = memoryShowMs(count);
  const flash: Block = { t: 'flash', ms, show: [{ t: 'row', items: shown.map((e) => emo(e)), size: 'md' }], then: [{ t: 'row', items: shown.map(() => Q), size: 'md' }] };
  return choiceQ(rng, `mem:${ans}`, 'Bạn nào vừa xuất hiện?', [flash], emo(ans), pool.slice(count).map((e) => emo(e)));
};

/** Ai biến mất: 4 bạn, sau đó còn 3. */
const missing = (count: number) => (rng: () => number) => {
  const pool = sample(ITEMS, count + 3, rng);
  const shown = pool.slice(0, count);
  const gone = pickOne(shown, rng);
  const ms = memoryShowMs(count);
  const flash: Block = {
    t: 'flash',
    ms,
    show: [{ t: 'row', items: shown.map((e) => emo(e)), size: 'md' }],
    then: [{ t: 'row', items: shuffle(shown.filter((e) => e !== gone), rng).map((e) => emo(e)), size: 'md' }],
  };
  const others = shuffle([...shown.filter((e) => e !== gone).slice(0, 2), ...pool.slice(count)], rng).slice(0, 3);
  return choiceQ(rng, `gone:${gone}`, 'Bạn nào đã biến mất?', [flash], emo(gone), others.map((e) => emo(e)));
};

/** Hai bức tranh, khác nhau `diffs` chỗ. */
const differences = (size: number, diffs: number) => (rng: () => number) => {
  const left = Array.from({ length: size * size }, () => pickOne(SMALL, rng));
  const right = [...left];
  const spots = sample(left.map((_, i) => i), diffs, rng);
  const changed: string[] = [];
  for (const i of spots) {
    const nw = pickOne(SMALL.filter((e) => e !== left[i]), rng);
    right[i] = nw;
    changed.push(nw);
  }
  const blocks: Block[] = [
    {
      t: 'pair',
      left: { t: 'grid', cols: size, cells: left.map((e) => emo(e)), size: 'sm', label: 'Tranh 1' },
      right: { t: 'grid', cols: size, cells: right.map((e) => emo(e)), size: 'sm', label: 'Tranh 2' },
    },
  ];
  if (diffs === 1) {
    const ans = changed[0]!;
    // Nhiễu: ưu tiên các hình cũng có mặt trong tranh 2 để bé phải so sánh thật.
    const inPicture = [...new Set(right)].filter((e) => e !== ans);
    const rest = SMALL.filter((e) => e !== ans && !inPicture.includes(e));
    const others = [...sample(inPicture, Math.min(3, inPicture.length), rng), ...sample(rest, Math.min(3, rest.length), rng)].slice(0, 3);
    return choiceQ(rng, `diff:${left.join('')}`, 'Ở tranh 2, hình nào đã bị đổi?', blocks, emo(ans), others.map((e) => emo(e)));
  }
  return numberQ(rng, `diffn:${left.join('')}`, 'Hai bức tranh khác nhau mấy chỗ?', blocks, diffs, { min: 1, max: 4 });
};

/** Nhớ thứ tự: chọn hàng đúng thứ tự vừa thấy. */
const order = (rng: () => number) => {
  const n = randomInt(rng, 3, 4);
  const shown = sample(ITEMS, n, rng);
  const row = (items: string[]): Visual => ({ t: 'row', items: items.map((e) => emo(e)) });
  const wrong: string[][] = [];
  while (wrong.length < 3) {
    const w = shuffle(shown, rng);
    if (w.join() !== shown.join() && !wrong.some((x) => x.join() === w.join())) wrong.push(w);
  }
  const flash: Block = { t: 'flash', ms: memoryShowMs(n), show: [{ t: 'row', items: shown.map((e) => emo(e)), size: 'md' }], then: [{ t: 'row', items: shown.map(() => Q), size: 'md' }] };
  return choiceQ(rng, `ord:${shown.join('')}`, 'Các bạn vừa xếp theo thứ tự nào?', [flash], row(shown), wrong.map(row));
};

export const observeTopic: Topic = {
  id: 'observe',
  name: 'Quan sát',
  icon: '🔍',
  description: 'Ghép bóng, ai biến mất, tìm chỗ khác nhau.',
  theme: { primary: '#FAB005', soft: '#FFF4CC', strong: '#A35F00' },
  sticker: 'eyes',
  levels: [
    { label: 'Ghép bóng', gen: silhouette },
    { label: 'Nhớ hình', gen: remember(3) },
    { label: 'Ai biến mất', gen: missing(4) },
    { label: 'Tìm 1 chỗ khác', gen: differences(3, 1) },
    { label: 'Đếm chỗ khác', gen: differences(4, 2) },
    { label: 'Nhớ thứ tự', gen: order },
  ],
};

export { memoryShowMs as observeShowMs };
