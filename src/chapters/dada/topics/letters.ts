import { pickOne, sample } from '../../../engine/random.js';
import { choiceQ, emo, txt } from '../kit.js';
import type { Topic } from '../topic.js';

/** Chữ cái và cách đọc theo âm (như ở lớp mầm non). */
export const LETTERS: { u: string; l: string; say: string }[] = [
  { u: 'A', l: 'a', say: 'a' }, { u: 'Ă', l: 'ă', say: 'á' }, { u: 'Â', l: 'â', say: 'ớ' }, { u: 'B', l: 'b', say: 'bờ' },
  { u: 'C', l: 'c', say: 'cờ' }, { u: 'D', l: 'd', say: 'dờ' }, { u: 'Đ', l: 'đ', say: 'đờ' }, { u: 'E', l: 'e', say: 'e' },
  { u: 'Ê', l: 'ê', say: 'ê' }, { u: 'G', l: 'g', say: 'gờ' }, { u: 'H', l: 'h', say: 'hờ' }, { u: 'I', l: 'i', say: 'i' },
  { u: 'K', l: 'k', say: 'ca' }, { u: 'L', l: 'l', say: 'lờ' }, { u: 'M', l: 'm', say: 'mờ' }, { u: 'N', l: 'n', say: 'nờ' },
  { u: 'O', l: 'o', say: 'o' }, { u: 'Ô', l: 'ô', say: 'ô' }, { u: 'Ơ', l: 'ơ', say: 'ơ' }, { u: 'P', l: 'p', say: 'pờ' },
  { u: 'Q', l: 'q', say: 'quờ' }, { u: 'R', l: 'r', say: 'rờ' }, { u: 'S', l: 's', say: 'sờ' }, { u: 'T', l: 't', say: 'tờ' },
  { u: 'U', l: 'u', say: 'u' }, { u: 'Ư', l: 'ư', say: 'ư' }, { u: 'V', l: 'v', say: 'vờ' }, { u: 'X', l: 'x', say: 'xờ' },
  { u: 'Y', l: 'y', say: 'i dài' },
];
const SIMPLE = LETTERS.filter((l) => !'ĂÂÊÔƠƯ'.includes(l.u));

/** Từ đơn có hình; chữ đầu tiên là chữ cái của từ. */
export const WORDS: { e: string; w: string }[] = [
  { e: '🐄', w: 'bò' }, { e: '🐟', w: 'cá' }, { e: '🐔', w: 'gà' }, { e: '🐱', w: 'mèo' }, { e: '🐘', w: 'voi' }, { e: '🦀', w: 'cua' },
  { e: '🍇', w: 'nho' }, { e: '🍦', w: 'kem' }, { e: '🐝', w: 'ong' }, { e: '⭐', w: 'sao' }, { e: '🍎', w: 'táo' }, { e: '🦆', w: 'vịt' },
  { e: '🐢', w: 'rùa' }, { e: '🐐', w: 'dê' }, { e: '🐷', w: 'lợn' }, { e: '🍃', w: 'lá' }, { e: '🌸', w: 'hoa' }, { e: '☂️', w: 'ô' },
];
const firstLetter = (w: string) => LETTERS.find((l) => l.l === w[0])!;

const findLetter = (rng: () => number) => {
  const [a, ...o] = sample(SIMPLE, 4, rng);
  return choiceQ(rng, `find:${a!.u}`, `Đâu là chữ ${a!.u}?`, [], txt(a!.u), o.map((x) => txt(x.u)), `Đâu là chữ ${a!.say}?`);
};

const letterCase = (rng: () => number) => {
  const [a, ...o] = sample(SIMPLE, 4, rng);
  return choiceQ(rng, `case:${a!.u}`, `Chữ ${a!.u} viết thường là chữ nào?`, [{ t: 'row', items: [txt(a!.u)], size: 'lg' }], txt(a!.l), o.map((x) => txt(x.l)), `Chữ ${a!.say} viết thường là chữ nào?`);
};

const wordStarts = (rng: () => number) => {
  const word = pickOne(WORDS, rng);
  const L = firstLetter(word.w);
  const others = sample(WORDS.filter((x) => firstLetter(x.w) !== L), 3, rng);
  return choiceQ(rng, `ws:${L.u}`, `Hình nào bắt đầu bằng chữ ${L.u}?`, [{ t: 'row', items: [txt(L.u)], size: 'lg' }], emo(word.e, word.w), others.map((x) => emo(x.e, x.w)), `Hình nào bắt đầu bằng chữ ${L.say}?`);
};

const firstOf = (rng: () => number) => {
  const word = pickOne(WORDS, rng);
  const L = firstLetter(word.w);
  const others = sample(LETTERS.filter((x) => x !== L), 3, rng);
  return choiceQ(rng, `fo:${word.w}`, `Chữ cái đầu tiên của từ "${word.w}" là chữ nào?`, [{ t: 'row', items: [emo(word.e, word.w), txt(word.w)], size: 'lg' }], txt(L.u), others.map((x) => txt(x.u)), `Chữ cái đầu tiên của từ ${word.w} là chữ nào?`);
};

const readWord = (rng: () => number) => {
  const [word, ...others] = sample(WORDS, 4, rng);
  return choiceQ(rng, `rw:${word!.w}`, 'Bé đọc từ này và chọn hình đúng nhé!', [{ t: 'text', v: word!.w, big: true }], emo(word!.e, word!.w), others.map((x) => emo(x.e, x.w)));
};

export const lettersTopic: Topic = {
  id: 'letters',
  name: 'Chữ cái',
  icon: '🔤',
  description: 'Nhận mặt chữ, chữ hoa – thường, chữ đầu của từ.',
  theme: { primary: '#E64980', soft: '#FFDEEB', strong: '#A61E4D' },
  sticker: 'pencil',
  levels: [
    { label: 'Chữ in hoa', gen: findLetter },
    { label: 'Hoa – thường', gen: letterCase },
    { label: 'Bắt đầu bằng chữ…', gen: wordStarts },
    { label: 'Chữ đầu của từ', gen: firstOf },
    { label: 'Tập đọc từ', gen: readWord },
  ],
};
