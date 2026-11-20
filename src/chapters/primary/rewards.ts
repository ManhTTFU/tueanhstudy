/**
 * Quy tắc xu, ôn câu sai và Thử thách 60 giây của nhóm 5–9 tuổi (THUẦN – client & server).
 */
import type { Rng } from '../../engine/types.js';
import { MENTAL_STAGES } from './mental.js';

/** Xu cho mỗi câu: đúng ngay lần đầu 2 xu, đúng sau khi thử lại 1 xu. */
export const COINS_FIRST_TRY = 2;
export const COINS_AFTER_RETRY = 1;

export function coinsForAnswers(answers: readonly { isCorrect: boolean }[]): number {
  return answers.reduce((s, a) => s + (a.isCorrect ? COINS_FIRST_TRY : COINS_AFTER_RETRY), 0);
}

/** Số câu sai được giữ lại để ôn (câu cũ nhất bị bỏ khi vượt quá). */
export const MAX_REVIEW_ITEMS = 40;
/** Số câu tối đa của một bài ôn. */
export const REVIEW_QUIZ_SIZE = 10;

export const reviewItemKey = (chapterId: string, questionId: string) => `${chapterId}|${questionId}`;

// ---------- Thử thách 60 giây ----------
export const CHALLENGE_MS = 60_000;
/** Cho phép nộp trễ (mạng chậm) tối đa bấy nhiêu sau khi hết giờ. */
export const CHALLENGE_GRACE_MS = 30_000;
/** Nhanh nhất có thể: mỗi câu ít nhất bấy nhiêu ms (chặn kết quả giả). */
export const CHALLENGE_MIN_MS_PER_ANSWER = 600;
export const CHALLENGE_QUESTIONS = 90;
/** Cứ 2 câu đúng được 1 xu. */
export const challengeCoins = (correct: number) => Math.floor(correct / 2);

export interface ChallengeQuestion {
  id: string;
  /** Ví dụ "8 + 5". */
  text: string;
  answer: number;
}

/** Đề thử thách: cộng, trừ qua 10 trong phạm vi 20, trộn ngẫu nhiên. */
export function generateChallenge(rng: Rng, count = CHALLENGE_QUESTIONS): ChallengeQuestion[] {
  const gens = [MENTAL_STAGES[0]!.gen, MENTAL_STAGES[1]!.gen];
  const out: ChallengeQuestion[] = [];
  let prev = '';
  while (out.length < count) {
    const q = gens[Math.floor(rng() * gens.length)]!(rng, 1);
    const text = (q.payload.eq ?? '').replace(/ = □$/, '');
    if (text === prev) continue;
    prev = text;
    out.push({ id: `c${out.length}`, text, answer: q.correctAnswer });
  }
  return out;
}

/** Tuần bắt đầu từ 0 giờ thứ Hai (giờ Việt Nam, UTC+7). */
export function weekStart(now: Date): Date {
  const VN = 7 * 3600_000;
  const local = new Date(now.getTime() + VN);
  const day = (local.getUTCDay() + 6) % 7; // thứ Hai = 0
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day);
  return new Date(startLocal - VN);
}
