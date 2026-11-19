/**
 * QuizEngine – điểm vào của bộ máy trò chơi dùng chung.
 *  - Sinh bộ câu hỏi cho BẤT KỲ chương nào (chỉ dựa vào cấu hình chương).
 *  - Kiểm tra tính hợp lệ của bộ câu hỏi.
 *  - Đánh giá bài nộp (server dùng để tự chấm điểm, không tin client).
 */
import { areOptionsValid } from './AnswerGenerator.js';
import { defaultRng } from './random.js';
import { computeScore } from './ScoringService.js';
import type { AnswerValue, ChapterDefinition, Question, QuizScore, Rng } from './types.js';

export function generateQuiz<P>(chapter: ChapterDefinition<P>, rng: Rng = defaultRng): Question<P>[] {
  const questions = chapter.generator.generate({
    rng,
    count: chapter.quiz.questionCount,
    range: chapter.range,
    optionCount: chapter.quiz.optionCount,
  });
  const problem = validateQuestionSet(questions, chapter.quiz.questionCount, chapter.quiz.optionCount);
  if (problem) throw new Error(`Bộ câu hỏi không hợp lệ (${chapter.id}): ${problem}`);
  return questions;
}

/** Trả về mô tả lỗi, hoặc `null` nếu hợp lệ. */
export function validateQuestionSet(
  questions: readonly Question<unknown>[],
  expectedCount: number,
  optionCount: number,
): string | null {
  if (questions.length !== expectedCount) return `cần ${expectedCount} câu, có ${questions.length}`;
  if (new Set(questions.map((q) => q.id)).size !== questions.length) return 'có câu hỏi trùng nhau';
  for (const q of questions) {
    // Số phương án: 2..optionCount (vd. "con nào to hơn?" chỉ có 2 lựa chọn).
    const n = q.options.length;
    if (n < 2 || n > optionCount || !areOptionsValid(q.options, q.correctAnswer, n)) {
      return `câu ${q.id} có phương án không hợp lệ`;
    }
  }
  return null;
}

export interface SubmittedAnswer {
  questionId: string;
  attempts: AnswerValue[];
}

export interface EvaluatedAnswer {
  questionIndex: number;
  questionId: string;
  questionType: string;
  correctAnswer: AnswerValue;
  selectedAnswer: AnswerValue;
  attemptHistory: AnswerValue[];
  isCorrect: boolean;
  attempts: number;
}

export type EvaluationResult =
  | { ok: true; score: QuizScore; answers: EvaluatedAnswer[] }
  | { ok: false; error: string };

/**
 * Đánh giá bài nộp dựa trên bộ câu hỏi GỐC (do server lưu).
 * Quy tắc hợp lệ cho mỗi câu:
 *  - có ít nhất 1 lần chọn, các lần chọn không trùng, đều thuộc phương án,
 *  - lần chọn cuối là đáp án đúng (bé phải chọn đúng mới qua câu),
 *  - đáp án đúng chỉ xuất hiện ở lần chọn cuối.
 * Điểm được tính theo LẦN CHỌN ĐẦU TIÊN.
 */
export function evaluateSubmission(
  questions: readonly Pick<Question<unknown>, 'id' | 'type' | 'correctAnswer' | 'options'>[],
  submitted: readonly SubmittedAnswer[],
): EvaluationResult {
  if (submitted.length !== questions.length) {
    return { ok: false, error: `Cần ${questions.length} câu trả lời, nhận ${submitted.length}` };
  }
  const answers: EvaluatedAnswer[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const s = submitted[i]!;
    if (s.questionId !== q.id) return { ok: false, error: `Câu ${i + 1} không khớp câu hỏi` };
    const attempts = s.attempts;
    if (attempts.length === 0) return { ok: false, error: `Câu ${i + 1} chưa được trả lời` };
    if (attempts.length > q.options.length) return { ok: false, error: `Câu ${i + 1} có quá nhiều lần chọn` };
    if (new Set(attempts).size !== attempts.length) return { ok: false, error: `Câu ${i + 1} có lần chọn trùng` };
    if (!attempts.every((a) => q.options.includes(a))) {
      return { ok: false, error: `Câu ${i + 1} có đáp án không thuộc phương án` };
    }
    if (attempts[attempts.length - 1] !== q.correctAnswer) {
      return { ok: false, error: `Câu ${i + 1} chưa được trả lời đúng` };
    }
    const first = attempts[0]!;
    answers.push({
      questionIndex: i,
      questionId: q.id,
      questionType: q.type,
      correctAnswer: q.correctAnswer,
      selectedAnswer: first,
      attemptHistory: [...attempts],
      isCorrect: first === q.correctAnswer,
      attempts: attempts.length,
    });
  }
  const correct = answers.filter((a) => a.isCorrect).length;
  return { ok: true, score: computeScore(correct, questions.length), answers };
}
