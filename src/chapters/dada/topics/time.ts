import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, Q, txt, type Visual } from '../kit.js';
import type { Topic } from '../topic.js';

const SEQS: { n: string; items: string[] }[] = [
  { n: 'gà con lớn lên', items: ['🥚', '🐣', '🐥', '🐔'] },
  { n: 'cây lớn lên', items: ['🌰', '🌱', '🌿', '🌳'] },
  { n: 'em bé lớn lên', items: ['👶', '🧒', '🧑', '🧓'] },
  { n: 'một ngày', items: ['🌅', '☀️', '🌇', '🌙'] },
  { n: 'buổi sáng của bé', items: ['😴', '🪥', '🥣', '🎒'] },
  { n: 'hoa nở', items: ['🌱', '🌿', '🌷', '💐'] },
];
const row = (items: string[]): Visual => ({ t: 'row', items: items.map((e) => emo(e)) });

const seqMissing = (rng: () => number) => {
  const s = pickOne(SEQS, rng);
  const hole = randomInt(rng, 0, s.items.length - 1);
  const ans = s.items[hole]!;
  const others = sample(SEQS.filter((x) => x !== s).flatMap((x) => x.items).filter((e) => !s.items.includes(e)), 3, rng);
  return choiceQ(rng, `sm:${s.n}:${hole}`, 'Tranh nào còn thiếu trong câu chuyện?', [{ t: 'row', items: s.items.map((e, i) => (i === hole ? Q : emo(e))), size: 'md' }], emo(ans), others.map((e) => emo(e)));
};

const seqOrder = (k: number) => (rng: () => number) => {
  const s = pickOne(SEQS, rng);
  const start = randomInt(rng, 0, s.items.length - k);
  const right = s.items.slice(start, start + k);
  const wrong: string[][] = [];
  while (wrong.length < 3) {
    const w = shuffle(right, rng);
    if (w.join() !== right.join() && !wrong.some((x) => x.join() === w.join())) wrong.push(w);
  }
  return choiceQ(rng, `so:${s.n}:${k}:${start}`, 'Hàng nào xếp đúng thứ tự trước – sau?', [{ t: 'text', v: `Câu chuyện: ${s.n}` }], row(right), wrong.map(row));
};

const TIMES = [
  { e: '🌅', n: 'buổi sáng' },
  { e: '☀️', n: 'buổi trưa' },
  { e: '🌙', n: 'buổi tối' },
];
const ACTS: [string, string, number][] = [
  ['🥣', 'ăn sáng', 0],
  ['🎒', 'đi học', 0],
  ['🐓', 'gà trống gáy', 0],
  ['🍱', 'ăn trưa', 1],
  ['😎', 'nắng chói chang', 1],
  ['🛌', 'đi ngủ', 2],
  ['🦉', 'cú mèo đi săn', 2],
  ['✨', 'sao lấp lánh', 2],
];
const dayTime = (rng: () => number) => {
  const [e, n, t] = pickOne(ACTS, rng);
  const tv = (x: (typeof TIMES)[number]): Visual => ({ t: 'row', items: [emo(x.e), txt(x.n)], n: x.n });
  return choiceQ(rng, `dt:${n}`, `${n[0]!.toUpperCase()}${n.slice(1)} vào buổi nào?`, [{ t: 'row', items: [emo(e, n)], size: 'lg' }], tv(TIMES[t]!), TIMES.filter((_, i) => i !== t).map(tv));
};

const DAYS = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
const weekday = (rng: () => number) => {
  const d = randomInt(rng, 0, 6);
  const next = rng() < 0.6;
  const ans = (d + (next ? 1 : 6)) % 7;
  const others = sample([0, 1, 2, 3, 4, 5, 6].filter((x) => x !== ans), 3, rng);
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  return choiceQ(rng, `wd:${d}:${next}`, `Hôm nay là ${DAYS[d]}. ${next ? 'Ngày mai' : 'Hôm qua'} là thứ mấy?`, [], txt(cap(DAYS[ans]!)), others.map((x) => txt(cap(DAYS[x]!))));
};

const clock = (rng: () => number) => {
  const h = randomInt(rng, 1, 12);
  const others = sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((x) => x !== h), 3, rng);
  return choiceQ(rng, `clk:${h}`, 'Đồng hồ chỉ mấy giờ?', [{ t: 'row', items: [{ t: 'clock', h }], size: 'lg' }], txt(`${h} giờ`), others.map((x) => txt(`${x} giờ`)));
};

export const timeTopic: Topic = {
  id: 'time',
  name: 'Thời gian',
  icon: '⏰',
  description: 'Trước – sau, sáng – trưa – tối, thứ, xem đồng hồ.',
  theme: { primary: '#5C7CFA', soft: '#E5EBFF', strong: '#364FC7' },
  sticker: 'alarm-clock',
  levels: [
    { label: 'Tranh còn thiếu', gen: seqMissing },
    { label: 'Xếp 3 tranh', gen: seqOrder(3) },
    { label: 'Xếp 4 tranh', gen: seqOrder(4) },
    { label: 'Sáng, trưa, tối', gen: dayTime },
    { label: 'Thứ trong tuần', gen: weekday },
    { label: 'Xem đồng hồ', gen: clock },
  ],
};
