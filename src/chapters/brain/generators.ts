/**
 * "Sân chơi trí tuệ" – bộ sinh câu hỏi cho 5 kỹ năng (phần THUẦN – client & server).
 *
 * Phương án trả lời là HÌNH nhưng giá trị vẫn là số (vị trí của hình trong thư viện
 * OBJECTS) để dùng chung bộ máy chấm điểm. `payload.choices` lưu value -> id hình,
 * nên dù thư viện hình thay đổi, câu hỏi đã lưu vẫn hiển thị đúng.
 *
 * Thêm kỹ năng mới: viết thêm một bộ sinh ở đây + hình minh hoạ trong
 * components/BrainViews.tsx, rồi khai báo trò chơi trong config.ts.
 */
import { OBJECTS, type CountableObject, type ObjectCategory } from '../../data/objects/catalog.js';
import { generateNumericOptions } from '../../engine/AnswerGenerator.js';
import { createQuestionGenerator } from '../../engine/QuestionGenerator.js';
import { pickOne, randomInt, sample, shuffle } from '../../engine/random.js';
import type { Question, QuestionGenerator, Rng } from '../../engine/types.js';

export const BRAIN_TYPE = 'brain';

/** value (vị trí trong OBJECTS) -> id hình. */
export type Choices = Record<string, string>;

export type BrainPayload =
  /** Quan sát: tìm hình giống hình mẫu. */
  | { kind: 'observe'; target: string; choices: Choices }
  /** Chú ý: đếm đúng loại hình lẫn trong nhiều hình. */
  | { kind: 'attention'; target: string; label: string; grid: string[] }
  /** Tư duy – quy luật: hình tiếp theo của dãy. */
  | { kind: 'pattern'; sequence: string[]; choices: Choices }
  /** Tư duy – khác loại: hình nào không cùng nhóm. */
  | { kind: 'odd'; choices: Choices }
  /** Ghi nhớ: nhìn vài hình rồi chọn hình vừa thấy. */
  | { kind: 'memory'; shown: string[]; choices: Choices }
  /** Tưởng tượng: cái bóng là của hình nào. */
  | { kind: 'silhouette'; target: string; choices: Choices };

export type BrainKind = BrainPayload['kind'];

const INDEX = new Map(OBJECTS.map((o, i) => [o.id, i]));
export const objectValue = (id: string): number => INDEX.get(id)!;

const byCategory = (category: ObjectCategory) => OBJECTS.filter((o) => o.category === category);

/** Phương án hình: đáp án đúng + nhiễu, đã xáo trộn. */
function imageOptions(correct: CountableObject, distractors: CountableObject[], rng: Rng) {
  const all = shuffle([correct, ...distractors], rng);
  const choices: Choices = {};
  for (const o of all) choices[String(objectValue(o.id))] = o.id;
  return { options: all.map((o) => objectValue(o.id)), correctAnswer: objectValue(correct.id), choices };
}

/** Nhiễu "khó": ưu tiên cùng nhóm (cùng là trái cây, cùng là con vật…). */
function similarDistractors(target: CountableObject, count: number, rng: Rng, exclude: Set<string> = new Set()): CountableObject[] {
  const same = byCategory(target.category).filter((o) => o.id !== target.id && !exclude.has(o.id));
  const picked = sample(same, Math.min(count, same.length), rng);
  if (picked.length < count) {
    const rest = OBJECTS.filter((o) => o.id !== target.id && !exclude.has(o.id) && !picked.includes(o));
    picked.push(...sample(rest, count - picked.length, rng));
  }
  return picked;
}

/** Hình chưa dùng làm "nhân vật chính" trong bài (để mỗi câu một hình khác). */
function freshObject(previous: Question<BrainPayload>[], rng: Rng, pool: readonly CountableObject[] = OBJECTS): CountableObject {
  const used = new Set(previous.map((q) => q.id.split(':')[1]));
  const fresh = pool.filter((o) => !used.has(o.id));
  return pickOne(fresh.length ? fresh : pool, rng);
}

const gen = (create: (rng: Rng, previous: Question<BrainPayload>[]) => Question<BrainPayload>): QuestionGenerator<BrainPayload> =>
  createQuestionGenerator<BrainPayload>(BRAIN_TYPE, (ctx, _i, previous) => create(ctx.rng, previous));

// ---------- Quan sát ----------
export const observeGenerator = gen((rng, previous) => {
  const target = freshObject(previous, rng);
  const opts = imageOptions(target, similarDistractors(target, 3, rng), rng);
  return {
    id: `observe:${target.id}`,
    type: BRAIN_TYPE,
    prompt: 'Hình nào giống hình mẫu?',
    payload: { kind: 'observe', target: target.id, choices: opts.choices },
    correctAnswer: opts.correctAnswer,
    options: opts.options,
  };
});

// ---------- Chú ý ----------
/** Lưới 9–12 hình: 2–6 hình cần đếm, còn lại là 1–2 loại hình cùng nhóm để gây nhiễu. */
export const attentionGenerator = gen((rng, previous) => {
  const target = freshObject(previous, rng);
  const count = randomInt(rng, 2, 6);
  const size = randomInt(rng, Math.max(9, count + 4), 12);
  const others = similarDistractors(target, randomInt(rng, 1, 2), rng);
  const grid = shuffle(
    [...Array.from({ length: count }, () => target.id), ...Array.from({ length: size - count }, (_, i) => others[i % others.length]!.id)],
    rng,
  );
  return {
    id: `attention:${target.id}`,
    type: BRAIN_TYPE,
    prompt: `Có bao nhiêu ${target.label}?`,
    payload: { kind: 'attention', target: target.id, label: target.label, grid },
    correctAnswer: count,
    options: generateNumericOptions({ correct: count, range: { min: 1, max: 8 }, count: 4, rng, nearRatio: 0.67 }),
  };
});

// ---------- Tư duy ----------
/** Các dạng quy luật cho bé 3–6 tuổi. */
const PATTERNS = ['AB', 'AAB', 'ABB', 'ABC'] as const;

function patternQuestion(rng: Rng, previous: Question<BrainPayload>[]): Question<BrainPayload> {
  const shape = pickOne(PATTERNS, rng);
  const first = freshObject(previous, rng);
  const units = [first, ...sample(OBJECTS.filter((o) => o.id !== first.id && o.category !== first.category), 2, rng)];
  const unit = [...shape].map((ch) => units[ch.charCodeAt(0) - 65]!);
  const length = 6; // hiện 6 hình, bé đoán hình thứ 7
  const full = Array.from({ length: length + 1 }, (_, i) => unit[i % unit.length]!);
  const answer = full[length]!;
  const inPattern = [...new Map(unit.map((o) => [o.id, o])).values()].filter((o) => o.id !== answer.id);
  const distractors = [...inPattern, ...similarDistractors(answer, 3, rng, new Set(inPattern.map((o) => o.id)))].slice(0, 3);
  const opts = imageOptions(answer, distractors, rng);
  return {
    id: `pattern:${first.id}`,
    type: BRAIN_TYPE,
    prompt: 'Hình tiếp theo là hình nào?',
    payload: { kind: 'pattern', sequence: full.slice(0, length).map((o) => o.id), choices: opts.choices },
    correctAnswer: opts.correctAnswer,
    options: opts.options,
  };
}

/** Nhóm dễ phân biệt cho bé (tránh cặp gây tranh cãi như "cây" và "hoa"). */
const ODD_GROUPS: ObjectCategory[] = ['animal', 'fruit', 'thing', 'flower'];

function oddQuestion(rng: Rng, previous: Question<BrainPayload>[]): Question<BrainPayload> {
  const [main, other] = sample(ODD_GROUPS, 2, rng);
  const odd = freshObject(previous, rng, byCategory(other!));
  const opts = imageOptions(odd, sample(byCategory(main!), 3, rng), rng);
  return {
    id: `odd:${odd.id}`,
    type: BRAIN_TYPE,
    prompt: 'Hình nào khác loại?',
    payload: { kind: 'odd', choices: opts.choices },
    correctAnswer: opts.correctAnswer,
    options: opts.options,
  };
}

/** Xen kẽ: câu lẻ là tìm quy luật, câu chẵn là tìm hình khác loại. */
export const logicGenerator = createQuestionGenerator<BrainPayload>(BRAIN_TYPE, (ctx, index, previous) =>
  index % 2 === 0 ? patternQuestion(ctx.rng, previous) : oddQuestion(ctx.rng, previous),
);

// ---------- Ghi nhớ ----------
export const MEMORY_SHOWN = 3;
/** Thời gian bé được nhìn các hình trước khi chúng bị úp lại. */
export const memoryShowMs = (shownCount: number) => 1500 + 900 * shownCount;

export const memoryGenerator = gen((rng, previous) => {
  const answer = freshObject(previous, rng);
  const others = sample(OBJECTS.filter((o) => o.id !== answer.id), MEMORY_SHOWN - 1 + 3, rng);
  const shown = shuffle([answer, ...others.slice(0, MEMORY_SHOWN - 1)], rng);
  const opts = imageOptions(answer, others.slice(MEMORY_SHOWN - 1), rng);
  return {
    id: `memory:${answer.id}`,
    type: BRAIN_TYPE,
    prompt: 'Hình nào bé vừa thấy?',
    payload: { kind: 'memory', shown: shown.map((o) => o.id), choices: opts.choices },
    correctAnswer: opts.correctAnswer,
    options: opts.options,
  };
});

// ---------- Tưởng tượng ----------
export const silhouetteGenerator = gen((rng, previous) => {
  const target = freshObject(previous, rng);
  const opts = imageOptions(target, similarDistractors(target, 3, rng), rng);
  return {
    id: `silhouette:${target.id}`,
    type: BRAIN_TYPE,
    prompt: 'Cái bóng này là của hình nào?',
    payload: { kind: 'silhouette', target: target.id, choices: opts.choices },
    correctAnswer: opts.correctAnswer,
    options: opts.options,
  };
});

/** Id hình của một phương án (null nếu câu hỏi trả lời bằng số). */
export function choiceObjectId(payload: BrainPayload, value: number): string | null {
  return 'choices' in payload ? (payload.choices[String(value)] ?? null) : null;
}
