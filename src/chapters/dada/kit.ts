/**
 * Bộ khung "Sân chơi tư duy" (phần THUẦN – client & server).
 *
 * Mỗi câu hỏi = lời hỏi + các KHỐI hình (Block) + phương án. Giao diện chung
 * (components/DadaViews.tsx) vẽ mọi khối, nên một dạng bài mới chỉ cần viết
 * hàm sinh câu hỏi trong topics/<chủ đề>.ts.
 *
 * Phương án dạng hình: giá trị là vị trí 0..n-1, `choices[value]` là hình hiển thị.
 * Phương án dạng số: không có `choices`, giá trị chính là con số.
 */
import { generateNumericOptions } from '../../engine/AnswerGenerator.js';
import { shuffle } from '../../engine/random.js';
import type { NumberRange, Question, QuestionGenerator, Rng } from '../../engine/types.js';

export const DADA_TYPE = 'dada';

export type ShapeId = 'circle' | 'square' | 'triangle' | 'rect' | 'star' | 'heart';

/** Một hình hiển thị. `n` = tên (đọc cho trình đọc màn hình / lịch sử phụ huynh). */
export type Visual =
  | { t: 'emoji'; e: string; n?: string; scale?: number; shadow?: boolean }
  | { t: 'balloon'; c: string; n?: string }
  | { t: 'color'; c: string; n: string }
  | { t: 'shape'; s: ShapeId; c: string; n?: string; scale?: number }
  | { t: 'text'; v: string; n?: string }
  | { t: 'group'; items: Visual[]; n?: string }
  | { t: 'row'; items: Visual[]; n?: string }
  | { t: 'clock'; h: number; n?: string }
  | { t: 'q' }
  | { t: 'blank' };

export type Block =
  /** Một hàng hình, `label` = nhãn nhỏ phía trên (vd. "Hình mẫu"). */
  | { t: 'row'; items: Visual[]; label?: string; size?: 'lg' | 'md' | 'sm' }
  /** Lưới `cols` cột. */
  | { t: 'grid'; cols: number; cells: Visual[]; label?: string; size?: 'md' | 'sm' }
  /** Hai bên đặt cạnh nhau (vd. tìm chỗ khác nhau). */
  | { t: 'pair'; left: Block; right: Block }
  /** Hiện `show` trong `ms` mili giây, sau đó thay bằng `then` (trò ghi nhớ). */
  | { t: 'flash'; ms: number; show: Block[]; then: Block[] }
  /** Một dòng chữ (câu chuyện, từ cần đọc). */
  | { t: 'text'; v: string; big?: boolean }
  /** Mê cung: `open[i]` = bitmask lối đi của ô i (1 lên, 2 phải, 4 xuống, 8 trái). */
  | { t: 'maze'; w: number; open: number[]; marks: Record<string, Visual> };

export type DadaPayload = {
  blocks: Block[];
  /** Câu đọc (mặc định là lời hỏi) – vd. "Đâu là chữ bờ?" khi lời hỏi là "Đâu là chữ B?". */
  say?: string;
  choices?: Record<string, Visual>;
};

export type DadaQuestion = Question<DadaPayload>;

// ---------- Tạo câu hỏi ----------

/** Câu hỏi chọn hình: `key` để chống trùng trong bài. */
export function choiceQ(
  rng: Rng,
  key: string,
  prompt: string,
  blocks: Block[],
  correct: Visual,
  distractors: Visual[],
  say?: string,
): DadaQuestion {
  const all = shuffle([correct, ...distractors], rng);
  const choices: Record<string, Visual> = {};
  all.forEach((v, i) => (choices[String(i)] = v));
  return {
    id: key,
    type: DADA_TYPE,
    prompt,
    payload: { blocks, choices, ...(say ? { say } : {}) },
    correctAnswer: all.indexOf(correct),
    options: all.map((_, i) => i),
  };
}

/** Câu hỏi trả lời bằng số. */
export function numberQ(
  rng: Rng,
  key: string,
  prompt: string,
  blocks: Block[],
  answer: number,
  range: NumberRange,
  say?: string,
): DadaQuestion {
  return {
    id: key,
    type: DADA_TYPE,
    prompt,
    payload: { blocks, ...(say ? { say } : {}) },
    correctAnswer: answer,
    options: generateNumericOptions({ correct: answer, range, count: 4, rng, nearRatio: 0.67 }),
  };
}

export type LevelGen = (rng: Rng, index: number) => DadaQuestion;

/**
 * Bộ sinh 1 bài: gọi `gen` cho từng câu, cố tránh câu trùng `id`; dạng bài ít
 * biến thể vẫn chạy được (id được thêm hậu tố để luôn duy nhất).
 */
export function levelGenerator(gen: LevelGen): QuestionGenerator<DadaPayload> {
  return {
    type: DADA_TYPE,
    generate(ctx) {
      const out: DadaQuestion[] = [];
      const used = new Set<string>();
      for (let i = 0; i < ctx.count; i++) {
        let q = gen(ctx.rng, i);
        for (let a = 0; a < 40 && used.has(q.id); a++) q = gen(ctx.rng, i);
        if (used.has(q.id)) q = { ...q, id: `${q.id}#${i}` };
        used.add(q.id);
        out.push(q);
      }
      return out;
    },
  };
}

/** Trộn nhiều dạng bài trong một cấp (luân phiên theo thứ tự câu). */
export const mix = (...gens: LevelGen[]): LevelGen => (rng, i) => gens[i % gens.length]!(rng, i);

// ---------- Tiện ích hình ----------
export const emo = (e: string, n?: string, scale?: number): Visual => ({ t: 'emoji', e, ...(n ? { n } : {}), ...(scale ? { scale } : {}) });
export const txt = (v: string, n?: string): Visual => ({ t: 'text', v, ...(n ? { n } : {}) });
export const group = (e: string, count: number, n?: string): Visual => ({ t: 'group', items: Array.from({ length: count }, () => emo(e)), n: n ?? `${count}` });
export const Q: Visual = { t: 'q' };

/** Nhãn đọc của một hình (cho phụ huynh / trình đọc màn hình). */
export function visualLabel(v: Visual): string {
  if ('n' in v && v.n) return v.n;
  switch (v.t) {
    case 'emoji':
      return v.e;
    case 'text':
      return v.v;
    case 'clock':
      return `${v.h} giờ`;
    case 'row':
    case 'group':
      return v.items.map(visualLabel).join(' ');
    default:
      return 'hình';
  }
}

/** `k` số khác `ans` trong [min, max], ưu tiên số gần `ans`. */
export function nearNumbers(ans: number, min: number, max: number, k: number, rng: () => number): number[] {
  const pool: number[] = [];
  for (let d = 1; pool.length < k + 2 && d <= max - min; d++) {
    if (ans - d >= min) pool.push(ans - d);
    if (ans + d <= max) pool.push(ans + d);
  }
  return shuffle(pool, rng).slice(0, k);
}

export interface Named {
  e: string;
  n: string;
}

/** Tên file giọng đọc cho một câu bất kỳ (băm FNV-1a, ổn định giữa client/server/script). */
export function speechFile(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `dada/${h.toString(16).padStart(8, '0')}`;
}

export const speechOf = (q: DadaQuestion): string => q.payload.say ?? q.prompt;

/** Thời gian (ms) cần ẩn phương án: lâu nhất trong các khối "flash". */
export function flashMs(blocks: Block[]): number {
  return blocks.reduce((m, b) => (b.t === 'flash' ? Math.max(m, b.ms) : m), 0);
}
