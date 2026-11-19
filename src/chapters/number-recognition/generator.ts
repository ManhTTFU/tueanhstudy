import { generateNumericOptions } from '../../engine/AnswerGenerator.js';
import { createQuestionGenerator } from '../../engine/QuestionGenerator.js';
import { pickOne, rangeArray } from '../../engine/random.js';

export const NUMBER_RECOGNITION_TYPE = 'number-recognition';

export type NumberRecognitionPayload = {
  number: number;
};

/**
 * Mỗi câu hiển thị một chữ số lớn, bé chọn đúng số đó trong 4 phương án.
 * Số được lấy từ những số CHƯA xuất hiện trong bài => không trùng câu hỏi.
 */
export const numberRecognitionGenerator = createQuestionGenerator<NumberRecognitionPayload>(
  NUMBER_RECOGNITION_TYPE,
  (ctx, _index, previous) => {
    const used = new Set(previous.map((q) => q.payload.number));
    const available = rangeArray(ctx.range.min, ctx.range.max).filter((n) => !used.has(n));
    const number = pickOne(available, ctx.rng);
    return {
      id: `nr-${number}`,
      type: NUMBER_RECOGNITION_TYPE,
      prompt: 'Đây là số mấy?',
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
