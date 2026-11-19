import { OBJECTS } from '../../data/objects/catalog.js';
import { generateNumericOptions } from '../../engine/AnswerGenerator.js';
import { createQuestionGenerator } from '../../engine/QuestionGenerator.js';
import { pickOne } from '../../engine/random.js';
import type { QuestionGenerator } from '../../engine/types.js';
import { OPERATIONS, type ArithmeticLevel, type OperationId } from './operations.js';

export const ARITHMETIC_TYPE = 'arithmetic';

export type ArithmeticPayload = {
  op: OperationId;
  a: number;
  b: number;
  /** Hình minh hoạ (thư viện hình của "Bé tập đếm"). */
  objectId: string;
};

/**
 * Bộ sinh câu hỏi cho một phép tính ở một cấp:
 *  - mỗi phép tính chỉ xuất hiện 1 lần trong bài,
 *  - mỗi câu một loại hình khác nhau,
 *  - 4 phương án trong phạm vi của cấp.
 */
export function createArithmeticGenerator(opId: OperationId, level: ArithmeticLevel): QuestionGenerator<ArithmeticPayload> {
  const op = OPERATIONS[opId];
  const allPairs = op.pairs(level);
  const answerRange = op.answerRange(level);
  return createQuestionGenerator<ArithmeticPayload>(ARITHMETIC_TYPE, (ctx, _index, previous) => {
    const used = new Set(previous.map((q) => `${q.payload.a}-${q.payload.b}`));
    const [a, b] = pickOne(
      allPairs.filter(([x, y]) => !used.has(`${x}-${y}`)),
      ctx.rng,
    );
    const usedObjects = new Set(previous.map((q) => q.payload.objectId));
    const object = pickOne(
      OBJECTS.filter((o) => !usedObjects.has(o.id)),
      ctx.rng,
    );
    const correct = op.compute(a, b);
    return {
      id: `${op.id}-${a}-${b}`,
      type: ARITHMETIC_TYPE,
      prompt: `${a} ${op.symbol} ${b} = ?`,
      payload: { op: op.id, a, b, objectId: object.id },
      correctAnswer: correct,
      options: generateNumericOptions({ correct, range: answerRange, count: ctx.optionCount, rng: ctx.rng, nearRatio: 0.67 }),
    };
  });
}
