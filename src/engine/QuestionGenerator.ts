import type { Question, QuestionGenerator, QuestionGeneratorContext } from './types.js';

/**
 * Tiện ích tạo QuestionGenerator: chương chỉ cần mô tả cách tạo MỘT câu hỏi,
 * phần chống trùng và kiểm tra số lượng do bộ máy lo.
 */
export function createQuestionGenerator<P>(
  type: string,
  createQuestion: (ctx: QuestionGeneratorContext, index: number, previous: Question<P>[]) => Question<P>,
  maxAttemptsPerQuestion = 50,
): QuestionGenerator<P> {
  return {
    type,
    generate(ctx) {
      const questions: Question<P>[] = [];
      const usedIds = new Set<string>();
      for (let i = 0; i < ctx.count; i++) {
        let created: Question<P> | undefined;
        for (let attempt = 0; attempt < maxAttemptsPerQuestion; attempt++) {
          const candidate = createQuestion(ctx, i, questions);
          if (!usedIds.has(candidate.id)) {
            created = candidate;
            break;
          }
        }
        if (!created) {
          throw new Error(`Không thể sinh đủ ${ctx.count} câu hỏi không trùng cho "${type}"`);
        }
        usedIds.add(created.id);
        questions.push(created);
      }
      return questions;
    },
  };
}
