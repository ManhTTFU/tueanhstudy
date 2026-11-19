import { findNumberPrompt } from '../../data/numbers/numbers.js';
import { generateNumericOptions } from '../../engine/AnswerGenerator.js';
import { createQuestionGenerator } from '../../engine/QuestionGenerator.js';
import { pickOne, rangeArray } from '../../engine/random.js';

export const NUMBER_FINDING_TYPE = 'number-finding';

export type NumberFindingPayload = {
  number: number;
};

/**
 * Trò "Tìm số": bé NGHE câu hỏi "Đâu là số năm?" (không nhìn thấy chữ số)
 * rồi chọn đúng chữ số trong 4 phương án. Mỗi số chỉ hỏi 1 lần trong bài.
 */
export const numberFindingGenerator = createQuestionGenerator<NumberFindingPayload>(
  NUMBER_FINDING_TYPE,
  (ctx, _index, previous) => {
    const used = new Set(previous.map((q) => q.payload.number));
    const available = rangeArray(ctx.range.min, ctx.range.max).filter((n) => !used.has(n));
    const number = pickOne(available, ctx.rng);
    return {
      id: `nf-${number}`,
      type: NUMBER_FINDING_TYPE,
      prompt: findNumberPrompt(number),
      payload: { number },
      correctAnswer: number,
      options: generateNumericOptions({
        correct: number,
        range: ctx.range,
        count: ctx.optionCount,
        rng: ctx.rng,
        nearRatio: 0.34,
      }),
    };
  },
);
