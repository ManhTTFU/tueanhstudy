import { generateNumericOptions } from '../../engine/AnswerGenerator.js';
import { createQuestionGenerator } from '../../engine/QuestionGenerator.js';
import { pickOne, randomInt } from '../../engine/random.js';
import { OBJECTS, type CountableObject } from '../../data/objects/catalog.js';

export const OBJECT_COUNTING_TYPE = 'object-counting';

export type ObjectCountingPayload = {
  objectId: string;
  label: string;
  count: number;
};

/**
 * Tạo bộ sinh câu hỏi đếm hình. Mỗi câu:
 *  - một loại hình CHƯA dùng trong bài (không trùng câu hỏi),
 *  - số lượng ngẫu nhiên trong phạm vi, khác số lượng của câu liền trước.
 */
export function createObjectCountingGenerator(library: readonly CountableObject[] = OBJECTS) {
  return createQuestionGenerator<ObjectCountingPayload>(OBJECT_COUNTING_TYPE, (ctx, _index, previous) => {
    const usedObjects = new Set(previous.map((q) => q.payload.objectId));
    const available = library.filter((obj) => !usedObjects.has(obj.id));
    const object = pickOne(available.length > 0 ? available : library, ctx.rng);
    const lastCount = previous.at(-1)?.payload.count;
    let count = randomInt(ctx.rng, ctx.range.min, ctx.range.max);
    for (let i = 0; i < 10 && count === lastCount && ctx.range.max > ctx.range.min; i++) {
      count = randomInt(ctx.rng, ctx.range.min, ctx.range.max);
    }
    return {
      id: `oc-${object.id}-${count}`,
      type: OBJECT_COUNTING_TYPE,
      prompt: `Có bao nhiêu ${object.label}?`,
      payload: { objectId: object.id, label: object.label, count },
      correctAnswer: count,
      options: generateNumericOptions({
        correct: count,
        range: ctx.range,
        count: ctx.optionCount,
        rng: ctx.rng,
        nearRatio: 0.67,
      }),
    };
  });
}

export const objectCountingGenerator = createObjectCountingGenerator();
