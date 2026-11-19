/**
 * Kiểu dữ liệu cốt lõi của bộ máy trò chơi.
 * File này KHÔNG phụ thuộc React/DOM để server cũng dùng được.
 */

export type Rng = () => number;

/** Giá trị đáp án. Các chương toán hiện tại/tương lai đều dùng số nguyên. */
export type AnswerValue = number;

export interface Question<P = Record<string, unknown>> {
  /** Khoá duy nhất trong một bài (dùng để chống trùng câu hỏi). */
  id: string;
  /** Loại câu hỏi, trùng với `questionType` của chương. */
  type: string;
  /** Câu hỏi hiển thị, ví dụ "Đây là số mấy?". */
  prompt: string;
  /** Dữ liệu riêng của từng loại câu hỏi (số cần nhận biết, hình cần đếm, ...). */
  payload: P;
  correctAnswer: AnswerValue;
  /** Các phương án đã xáo trộn – luôn chứa `correctAnswer` đúng 1 lần. */
  options: AnswerValue[];
}

export interface NumberRange {
  min: number;
  max: number;
}

export interface QuestionGeneratorContext {
  rng: Rng;
  count: number;
  range: NumberRange;
  optionCount: number;
}

/** Mỗi chương chỉ cần cung cấp một QuestionGenerator. */
export interface QuestionGenerator<P = Record<string, unknown>> {
  readonly type: string;
  generate(ctx: QuestionGeneratorContext): Question<P>[];
}

export interface ChapterRewardConfig {
  /** Số kẹo khi đạt điểm tuyệt đối (mặc định 1). */
  candiesForPerfect: number;
  /** Sticker tặng khi đạt 10/10 lần đầu trong chương. */
  firstPerfectSticker?: string;
}

/** Cấu hình thuần (không có UI) của một chương học – dùng chung cho client & server. */
export interface ChapterDefinition<P = Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  /** Tên biểu tượng (Lucide) – phần UI tự ánh xạ. */
  icon: string;
  theme: ChapterTheme;
  order: number;
  enabled: boolean;
  range: NumberRange;
  questionType: string;
  quiz: {
    questionCount: number;
    optionCount: number;
    /** Thời gian tối thiểu hợp lệ cho cả bài (ms) – chống gửi kết quả giả. */
    minDurationMs: number;
  };
  /** Chương có giai đoạn học bằng thẻ trước khi kiểm tra không. */
  hasLearningStage: boolean;
  rewards: ChapterRewardConfig;
  generator: QuestionGenerator<P>;
}

export interface ChapterTheme {
  /** Màu chủ đạo (hex). */
  primary: string;
  /** Màu nền nhạt (hex). */
  soft: string;
  /** Màu đậm cho chữ/nút (hex). */
  strong: string;
}

/** Bản ghi trả lời cho một câu hỏi. */
export interface AnswerRecord {
  questionId: string;
  /** Các lần chọn theo thứ tự. Lần đầu dùng để chấm điểm. */
  attempts: AnswerValue[];
  /** Đã chọn đúng (ở bất kỳ lần nào) chưa. */
  solved: boolean;
}

export interface QuizScore {
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  /** Điểm thang 10 (làm tròn). */
  score: number;
  /** Tỷ lệ đúng 0–100 (làm tròn). */
  percent: number;
  isPerfectScore: boolean;
}

export type RewardType = 'candy' | 'sticker';

export interface RewardGrant {
  rewardType: RewardType;
  rewardCode: string;
  quantity: number;
  /** Khoá chống cộng trùng – UNIQUE trong database. */
  dedupeKey: string;
  /** Lý do để hiển thị cho bé/phụ huynh. */
  reason: string;
}
