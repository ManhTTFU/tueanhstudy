import type { AnswerRecord, Question, QuizScore } from './types.js';

/** Câu hỏi được tính đúng khi và chỉ khi LẦN TRẢ LỜI ĐẦU TIÊN đúng. */
export function isFirstAttemptCorrect(question: Pick<Question, 'correctAnswer'>, record: Pick<AnswerRecord, 'attempts'>): boolean {
  return record.attempts.length > 0 && record.attempts[0] === question.correctAnswer;
}

export function computeScore(correctAnswers: number, totalQuestions: number): QuizScore {
  const incorrectAnswers = totalQuestions - correctAnswers;
  const ratio = totalQuestions === 0 ? 0 : correctAnswers / totalQuestions;
  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    score: Math.round(ratio * 10),
    percent: Math.round(ratio * 100),
    isPerfectScore: totalQuestions > 0 && correctAnswers === totalQuestions,
  };
}

/** Chấm điểm cả bài theo lần trả lời đầu tiên của từng câu. */
export function scoreQuiz(
  questions: readonly Pick<Question, 'id' | 'correctAnswer'>[],
  records: readonly Pick<AnswerRecord, 'questionId' | 'attempts'>[],
): QuizScore {
  const byId = new Map(records.map((r) => [r.questionId, r]));
  let correct = 0;
  for (const q of questions) {
    const record = byId.get(q.id);
    if (record && isFirstAttemptCorrect(q, record)) correct++;
  }
  return computeScore(correct, questions.length);
}
