/**
 * QuizSession – máy trạng thái THUẦN (pure) của một phiên làm bài.
 * Không phụ thuộc React: UI chỉ việc gọi các hàm chuyển trạng thái.
 *
 *  answering --(chọn đúng)--> correct --(next)--> answering (câu sau) | finished
 *  answering --(chọn sai)---> wrong   --(retry)-> answering (cùng câu)
 */
import type { AnswerRecord, AnswerValue, Question } from './types.js';

export type QuizPhase = 'answering' | 'correct' | 'wrong' | 'finished';

export interface QuizSessionState {
  /** ID phiên do server cấp; `null` khi chơi ngoại tuyến (không lưu được). */
  sessionId: string | null;
  chapterId: string;
  questions: Question[];
  currentIndex: number;
  records: AnswerRecord[];
  phase: QuizPhase;
  lastSelected: AnswerValue | null;
  startedAt: number;
  finishedAt: number | null;
}

export interface CreateQuizSessionInput {
  sessionId: string | null;
  chapterId: string;
  questions: Question[];
  now?: number;
}

export function createQuizSession({ sessionId, chapterId, questions, now = Date.now() }: CreateQuizSessionInput): QuizSessionState {
  if (questions.length === 0) throw new Error('Bài kiểm tra phải có ít nhất 1 câu hỏi');
  return {
    sessionId,
    chapterId,
    questions,
    currentIndex: 0,
    records: questions.map((q) => ({ questionId: q.id, attempts: [], solved: false })),
    phase: 'answering',
    lastSelected: null,
    startedAt: now,
    finishedAt: null,
  };
}

export function getCurrentQuestion(state: QuizSessionState): Question | undefined {
  return state.questions[state.currentIndex];
}

export function getCurrentRecord(state: QuizSessionState): AnswerRecord | undefined {
  return state.records[state.currentIndex];
}

/** Các phương án sai bé đã thử ở câu hiện tại (UI làm mờ để bé không chọn lại). */
export function getTriedWrongOptions(state: QuizSessionState): AnswerValue[] {
  const q = getCurrentQuestion(state);
  const r = getCurrentRecord(state);
  if (!q || !r) return [];
  return r.attempts.filter((a) => a !== q.correctAnswer);
}

/**
 * Bé chọn một đáp án. Bị bỏ qua (trả lại nguyên state) khi:
 *  - đang hiển thị phản hồi / đã kết thúc (chống bấm liên tục),
 *  - đáp án không thuộc danh sách phương án,
 *  - đáp án sai đã chọn trước đó.
 */
export function answerQuestion(state: QuizSessionState, value: AnswerValue): QuizSessionState {
  if (state.phase !== 'answering') return state;
  const question = getCurrentQuestion(state);
  const record = getCurrentRecord(state);
  if (!question || !record) return state;
  if (!question.options.includes(value)) return state;
  if (record.attempts.includes(value)) return state;

  const correct = value === question.correctAnswer;
  const updated: AnswerRecord = {
    ...record,
    attempts: [...record.attempts, value],
    solved: correct,
  };
  const records = state.records.map((r, i) => (i === state.currentIndex ? updated : r));
  return { ...state, records, phase: correct ? 'correct' : 'wrong', lastSelected: value };
}

/** Sau khi trả lời sai, cho phép bé thử lại cùng câu hỏi. */
export function retryQuestion(state: QuizSessionState): QuizSessionState {
  if (state.phase !== 'wrong') return state;
  return { ...state, phase: 'answering', lastSelected: null };
}

/** Chuyển sang câu tiếp theo (chỉ sau khi đã trả lời đúng). */
export function nextQuestion(state: QuizSessionState, now: number = Date.now()): QuizSessionState {
  if (state.phase !== 'correct') return state;
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.questions.length) {
    return { ...state, phase: 'finished', finishedAt: now, lastSelected: null };
  }
  return { ...state, currentIndex: nextIndex, phase: 'answering', lastSelected: null };
}

export function isQuizFinished(state: QuizSessionState): boolean {
  return state.phase === 'finished';
}

/** Dữ liệu gửi lên server: chỉ gửi các lần chọn, server tự chấm điểm. */
export interface QuizSubmission {
  answers: { questionId: string; attempts: AnswerValue[] }[];
  clientDurationMs: number;
}

export function toSubmission(state: QuizSessionState): QuizSubmission {
  return {
    answers: state.records.map((r) => ({ questionId: r.questionId, attempts: [...r.attempts] })),
    clientDurationMs: (state.finishedAt ?? Date.now()) - state.startedAt,
  };
}
