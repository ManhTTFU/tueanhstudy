/**
 * Cấu hình phần thưởng – thay đổi số liệu ở đây, không cần sửa bộ máy.
 */
export const REWARD_CONFIG = {
  /** Kẹo mặc định cho mỗi bài đạt 10/10 (chương có thể ghi đè). */
  defaultCandiesForPerfect: 1,
  /** Số kẹo tích luỹ để mở 1 hộp quà (kẹo không bị trừ đi). */
  candiesPerGift: 10,
} as const;

/** Thành tích tặng sticker (ngoài sticker 10/10 lần đầu của từng chương). */
export const ACHIEVEMENTS = [
  { code: 'first-quiz', sticker: 'glowing-star', reason: 'Hoàn thành bài đầu tiên', completedQuizzes: 1 },
  { code: 'five-quizzes', sticker: 'rainbow', reason: 'Hoàn thành 5 bài', completedQuizzes: 5 },
  { code: 'ten-quizzes', sticker: 'rocket', reason: 'Hoàn thành 10 bài', completedQuizzes: 10 },
  { code: 'twenty-quizzes', sticker: 'crown', reason: 'Hoàn thành 20 bài', completedQuizzes: 20 },
] as const;

export const PERFECT_STREAK_ACHIEVEMENTS = [
  { code: 'three-perfect', sticker: 'gem-stone', reason: 'Đạt 10/10 ba lần', perfectSessions: 3 },
] as const;
