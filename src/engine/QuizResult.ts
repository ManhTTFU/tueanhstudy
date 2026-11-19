import { encouragementFor } from './messages.js';
import { scoreQuiz } from './ScoringService.js';
import type { QuizSessionState } from './QuizSession.js';
import type { QuizScore, RewardGrant } from './types.js';

export interface QuizResult extends QuizScore {
  sessionId: string | null;
  chapterId: string;
  completedAt: string;
  encouragement: string;
  /** Phần thưởng mới nhận trong phiên (server xác nhận). */
  rewards: RewardGrant[];
  candiesEarned: number;
  /** false khi chưa lưu được lên server (ngoại tuyến). */
  saved: boolean;
}

/** Kết quả tạm tính phía client (dùng khi chưa có/không có phản hồi server). */
export function buildLocalResult(state: QuizSessionState): QuizResult {
  const score = scoreQuiz(state.questions, state.records);
  return {
    ...score,
    sessionId: state.sessionId,
    chapterId: state.chapterId,
    completedAt: new Date(state.finishedAt ?? Date.now()).toISOString(),
    encouragement: encouragementFor(score.score),
    rewards: [],
    candiesEarned: 0,
    saved: false,
  };
}
