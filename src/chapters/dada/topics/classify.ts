import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, numberQ, type Named } from '../kit.js';
import type { Topic } from '../topic.js';

const GROUPS: { n: string; items: Named[] }[] = [
  { n: 'trái cây', items: [{ e: '🍎', n: 'táo' }, { e: '🍌', n: 'chuối' }, { e: '🍇', n: 'nho' }, { e: '🍉', n: 'dưa hấu' }, { e: '🍓', n: 'dâu' }, { e: '🍊', n: 'cam' }] },
  { n: 'con vật', items: [{ e: '🐶', n: 'cún' }, { e: '🐱', n: 'mèo' }, { e: '🐰', n: 'thỏ' }, { e: '🐷', n: 'lợn' }, { e: '🐮', n: 'bò' }, { e: '🐵', n: 'khỉ' }] },
  { n: 'xe cộ', items: [{ e: '🚗', n: 'ô tô' }, { e: '🚲', n: 'xe đạp' }, { e: '🚌', n: 'xe buýt' }, { e: '🚂', n: 'tàu hỏa' }, { e: '✈️', n: 'máy bay' }, { e: '🚤', n: 'ca nô' }] },
  { n: 'quần áo', items: [{ e: '👕', n: 'áo' }, { e: '👖', n: 'quần' }, { e: '👗', n: 'váy' }, { e: '🧦', n: 'tất' }, { e: '🧢', n: 'mũ' }, { e: '👟', n: 'giày' }] },
  { n: 'đồ chơi', items: [{ e: '🧸', n: 'gấu bông' }, { e: '🪀', n: 'yo-yo' }, { e: '🪁', n: 'diều' }, { e: '⚽', n: 'bóng' }, { e: '🎲', n: 'xúc xắc' }, { e: '🪆', n: 'búp bê' }] },
];
const v = (x: Named) => emo(x.e, x.n);

const oddOne = (rng: () => number) => {
  const [main, other] = sample(GROUPS, 2, rng);
  const odd = pickOne(other!.items, rng);
  return choiceQ(rng, `odd:${odd.e}`, 'Bạn nào khác nhóm?', [], v(odd), sample(main!.items, 3, rng).map(v));
};

const countGroup = (rng: () => number) => {
  const [main, other] = sample(GROUPS, 2, rng);
  const n = randomInt(rng, 2, 5);
  const cells = shuffle([...sample(main!.items, n, rng), ...sample(other!.items, randomInt(rng, 2, 4), rng)], rng).map(v);
  return numberQ(rng, `cg:${main!.n}:${n}`, `Có bao nhiêu ${main!.n}?`, [{ t: 'grid', cols: 4, cells }], n, { min: 1, max: 6 });
};

const MOVES = [
  { q: 'Con nào biết bay?', yes: [{ e: '🐦', n: 'chim' }, { e: '🦋', n: 'bướm' }, { e: '🐝', n: 'ong' }, { e: '🦅', n: 'đại bàng' }] },
  { q: 'Con nào sống dưới nước?', yes: [{ e: '🐟', n: 'cá' }, { e: '🐙', n: 'bạch tuộc' }, { e: '🐳', n: 'cá voi' }, { e: '🦀', n: 'cua' }] },
  { q: 'Con nào đi trên cạn?', yes: [{ e: '🐘', n: 'voi' }, { e: '🐄', n: 'bò' }, { e: '🐕', n: 'chó' }, { e: '🐎', n: 'ngựa' }] },
];
const moves = (rng: () => number) => {
  const m = pickOne(MOVES, rng);
  const ans = pickOne(m.yes, rng);
  const others = sample(MOVES.filter((x) => x !== m).flatMap((x) => x.yes), 3, rng);
  return choiceQ(rng, `mv:${ans.e}`, m.q, [], v(ans), others.map(v));
};

const JOBS = [
  { e: '🧑‍⚕️', n: 'bác sĩ', t: [{ e: '🩺', n: 'ống nghe' }, { e: '💊', n: 'thuốc' }] },
  { e: '🧑‍🍳', n: 'đầu bếp', t: [{ e: '🍳', n: 'chảo' }, { e: '🥄', n: 'muôi' }] },
  { e: '🧑‍🚒', n: 'lính cứu hỏa', t: [{ e: '🚒', n: 'xe cứu hỏa' }, { e: '🧯', n: 'bình cứu hỏa' }] },
  { e: '🧑‍🌾', n: 'bác nông dân', t: [{ e: '🚜', n: 'máy cày' }, { e: '🌾', n: 'bó lúa' }] },
  { e: '🧑‍🏫', n: 'cô giáo', t: [{ e: '📚', n: 'sách' }, { e: '✏️', n: 'bút chì' }] },
  { e: '🧑‍🎨', n: 'họa sĩ', t: [{ e: '🎨', n: 'bảng màu' }, { e: '🖌️', n: 'cọ vẽ' }] },
];
const jobs = (rng: () => number) => {
  const j = pickOne(JOBS, rng);
  const tool = pickOne(j.t, rng);
  const others = sample(JOBS.filter((x) => x !== j).map((x) => pickOne(x.t, rng)), 3, rng);
  return choiceQ(rng, `job:${j.n}:${tool.e}`, `${j.n[0]!.toUpperCase()}${j.n.slice(1)} dùng đồ vật nào?`, [{ t: 'row', items: [emo(j.e, j.n)], size: 'lg' }], v(tool), others.map(v));
};

const LIFE = [
  { q: 'Trời mưa, bé cần mang gì?', show: '🌧️', a: { e: '☂️', n: 'ô' } },
  { q: 'Trời nắng, bé cần đội gì?', show: '☀️', a: { e: '🧢', n: 'mũ' } },
  { q: 'Trời lạnh, bé cần quàng gì?', show: '❄️', a: { e: '🧣', n: 'khăn' } },
  { q: 'Bé ngửi hoa bằng gì?', show: '🌸', a: { e: '👃', n: 'mũi' } },
  { q: 'Bé nghe nhạc bằng gì?', show: '🎵', a: { e: '👂', n: 'tai' } },
  { q: 'Bé nhìn cầu vồng bằng gì?', show: '🌈', a: { e: '👀', n: 'mắt' } },
  { q: 'Bé nếm kem bằng gì?', show: '🍦', a: { e: '👅', n: 'lưỡi' } },
];
const life = (rng: () => number) => {
  const l = pickOne(LIFE, rng);
  const others = sample(LIFE.filter((x) => x !== l).map((x) => x.a), 3, rng);
  return choiceQ(rng, `life:${l.q}`, l.q, [{ t: 'row', items: [emo(l.show)], size: 'lg' }], v(l.a), others.map(v));
};

const FEATURES = [
  { q: 'Cái gì có bánh xe?', yes: [{ e: '🚗', n: 'ô tô' }, { e: '🚲', n: 'xe đạp' }, { e: '🛴', n: 'xe trượt' }] },
  { q: 'Con nào có cánh?', yes: [{ e: '🐦', n: 'chim' }, { e: '🦋', n: 'bướm' }, { e: '🐞', n: 'bọ rùa' }] },
  { q: 'Cái gì phát sáng?', yes: [{ e: '💡', n: 'bóng đèn' }, { e: '🕯️', n: 'nến' }, { e: '🔦', n: 'đèn pin' }] },
  { q: 'Con nào có vỏ cứng?', yes: [{ e: '🐢', n: 'rùa' }, { e: '🐌', n: 'ốc sên' }, { e: '🦀', n: 'cua' }] },
];
const OTHER: Named[] = [{ e: '🐟', n: 'cá' }, { e: '🍎', n: 'táo' }, { e: '🧸', n: 'gấu bông' }, { e: '🐱', n: 'mèo' }, { e: '🌳', n: 'cây' }, { e: '📚', n: 'sách' }];
const features = (rng: () => number) => {
  const f = pickOne(FEATURES, rng);
  const ans = pickOne(f.yes, rng);
  const pool = [...OTHER, ...FEATURES.filter((x) => x !== f).flatMap((x) => x.yes)];
  return choiceQ(rng, `feat:${ans.e}`, f.q, [], v(ans), sample(pool, 3, rng).map(v));
};

export const classifyTopic: Topic = {
  id: 'classify',
  name: 'Phân loại',
  icon: '🧺',
  description: 'Xếp nhóm, nghề nghiệp, thời tiết, giác quan.',
  theme: { primary: '#AE3EC9', soft: '#F8E8FD', strong: '#862E9C' },
  sticker: 'basket',
  levels: [
    { label: 'Bạn khác nhóm', gen: oddOne },
    { label: 'Đếm theo nhóm', gen: countGroup },
    { label: 'Bay, bơi, đi', gen: moves },
    { label: 'Nghề nghiệp', gen: jobs },
    { label: 'Thời tiết, giác quan', gen: life },
    { label: 'Theo đặc điểm', gen: features },
  ],
};
