/**
 * Bộ khung nhóm 5–9 tuổi (tiểu học, lớp 1–3) – phần THUẦN (client & server).
 *
 * Câu hỏi là dữ liệu: đề bài (text), câu hỏi (ask), phép tính (eq), dãy (seq),
 * tháp số (pyramid)... do components/PrimaryViews.tsx vẽ chung.
 *  - Câu TỰ GÕ (`inputQ`): bé nhập đáp án bằng bàn phím số (Question.input = true).
 *  - Câu CHỌN (`pickQ`): giá trị là vị trí 0..n-1, `choices[value]` là chữ hiển thị.
 * Mỗi câu nên có `steps`: khi bé trả lời sai lần đầu, giao diện dẫn bé giải
 * từng bước nhỏ (chỉ để hướng dẫn – điểm vẫn tính theo lần trả lời đầu tiên).
 */
import { pickOne, randomInt, shuffle } from '../../engine/random.js';
import type { Question, QuestionGenerator, Rng } from '../../engine/types.js';

export const PRIMARY_TYPE = 'primary';

/** Một bước gợi ý. Có `choices` thì `a` là vị trí đáp án đúng trong `choices`. */
export interface Step {
  q: string;
  a: number;
  choices?: string[];
}

export type PrimaryPayload = {
  /** Đề bài / câu chuyện. */
  text?: string;
  /** Câu hỏi chính (in đậm). */
  ask?: string;
  /** Các dòng phép tính đã biết (vd. "🍎 + 🍎 = 10"). */
  lines?: string[];
  /** Phép tính cần điền, "□" là chỗ trống. */
  eq?: string;
  /** Dãy số / hình, "□" là ô trống. */
  seq?: string[];
  /** Tháp số từ đỉnh xuống đáy, null = ô cần tìm. */
  pyramid?: (number | null)[][];
  /** Đơn vị sau đáp án (vd. "viên bi"). */
  unit?: string;
  /** Mẹo ngắn. */
  tip?: string;
  steps?: Step[];
  /** Câu chọn: value -> chữ hiển thị. */
  choices?: Record<string, string>;
};

export type PrimaryQuestion = Question<PrimaryPayload>;
/** Sinh một câu hỏi ở mức độ L (1 = Khởi động, 2 = Nâng cao, 3 = Thử thách). */
export type Gen = (rng: Rng, L: number) => PrimaryQuestion;

// ---------- Tạo câu hỏi ----------

/** Câu bé tự gõ đáp án. `key` để chống trùng trong bài. */
export function inputQ(key: string, prompt: string, answer: number, payload: PrimaryPayload): PrimaryQuestion {
  return { id: key, type: PRIMARY_TYPE, prompt, payload, correctAnswer: answer, options: [], input: true };
}

/** Câu chọn 1 trong các nhãn chữ (`labels[correct]` là đáp án đúng); thứ tự được xáo trộn. */
export function pickQ(rng: Rng, key: string, prompt: string, labels: string[], correct: number, payload: PrimaryPayload): PrimaryQuestion {
  const order = shuffle(
    labels.map((_, i) => i),
    rng,
  );
  const choices: Record<string, string> = {};
  order.forEach((orig, pos) => (choices[String(pos)] = labels[orig]!));
  return {
    id: key,
    type: PRIMARY_TYPE,
    prompt,
    payload: { ...payload, choices },
    correctAnswer: order.indexOf(correct),
    options: order.map((_, pos) => pos),
  };
}

/**
 * Generator của một cấp: trộn các dạng bài (mỗi dạng có cấp tối thiểu),
 * xoay vòng để bài nào cũng có đủ dạng, tự tránh câu trùng.
 */
export function levelGen(gens: readonly (readonly [Gen, number])[], L: number): QuestionGenerator<PrimaryPayload> {
  const usable = gens.filter(([, min]) => L >= min).map(([g]) => g);
  if (usable.length === 0) throw new Error(`Cấp ${L} không có dạng bài nào`);
  return {
    type: PRIMARY_TYPE,
    generate(ctx) {
      const order = shuffle(usable, ctx.rng);
      const out: PrimaryQuestion[] = [];
      const used = new Set<string>();
      for (let i = 0; i < ctx.count; i++) {
        const gen = order[i % order.length]!;
        let q = gen(ctx.rng, L);
        for (let a = 0; a < 60 && used.has(q.id); a++) q = gen(ctx.rng, L);
        if (used.has(q.id)) q = { ...q, id: `${q.id}#${i}` };
        used.add(q.id);
        out.push(q);
      }
      return out;
    },
  };
}

// ---------- Tiện ích ----------

export const R = randomInt;
export const pick = pickOne;
/** Chọn giá trị theo mức độ (1, 2, 3). */
export const lv = <T>(L: number, a: T, b: T, c: T): T => (L <= 1 ? a : L === 2 ? b : c);

/** Dấu trừ đẹp (U+2212) dùng khi hiển thị. */
export const M = '−';

export const NAMES = ['An', 'Bình', 'Mai', 'Lan', 'Minh', 'Hà', 'Nam', 'Vy', 'Huy', 'Ngọc', 'Khoa', 'Thảo', 'Phúc', 'Linh'];
export const ITEMS = ['viên bi', 'quyển vở', 'bông hoa', 'cái kẹo', 'quả táo', 'nhãn vở', 'cái bút chì'];

/** Hai tên khác nhau. */
export function twoNames(rng: Rng): [string, string] {
  const [a, b] = shuffle(NAMES, rng);
  return [a!, b!];
}

export function threeNames(rng: Rng): [string, string, string] {
  const [a, b, c] = shuffle(NAMES, rng);
  return [a!, b!, c!];
}

/** Câu đọc to của một câu hỏi (đề + câu hỏi + phép tính). */
export function speechOfPrimary(q: PrimaryQuestion): string {
  const p = q.payload;
  const parts = [p.text, ...(p.lines ?? []), p.ask, p.eq].filter((s): s is string => Boolean(s));
  const text = parts.length ? parts.join('. ') : q.prompt;
  return text
    .replace(/□/g, ' mấy ')
    .replace(/[−-]/g, ' trừ ')
    .replace(/\+/g, ' cộng ')
    .replace(/=/g, ' bằng ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Các phương án cho một bước gợi ý dạng số (có đáp án đúng, xáo trộn theo hạt giống cố định). */
export function stepNumberChoices(answer: number, seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const rnd = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return h / 4294967296;
  };
  const near = answer >= 20 ? [1, 2, 10, -1, -2, -10] : [1, 2, 3, -1, -2, -3];
  const out = new Set<number>([answer]);
  for (const d of shuffle(near, rnd)) {
    if (out.size >= 3) break;
    if (answer + d >= 0) out.add(answer + d);
  }
  return shuffle([...out], rnd);
}
