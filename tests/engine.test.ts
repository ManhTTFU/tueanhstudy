import { describe, expect, it } from 'vitest';
import { CHAPTERS, getChapter } from '../src/chapters/registry';
import { numberRecognitionChapter } from '../src/chapters/number-recognition/config';
import { objectCountingChapter } from '../src/chapters/object-counting/config';
import { NUMBER_CARDS } from '../src/data/numbers/numbers';
import { OBJECTS, getObject } from '../src/data/objects/catalog';
import { STICKERS } from '../src/data/stickers';
import { generateNumericOptions, areOptionsValid } from '../src/engine/AnswerGenerator';
import { evaluateSubmission, generateQuiz } from '../src/engine/QuizEngine';
import {
  answerQuestion,
  createQuizSession,
  getTriedWrongOptions,
  nextQuestion,
  retryQuestion,
  toSubmission,
  type QuizSessionState,
} from '../src/engine/QuizSession';
import { createSeededRng } from '../src/engine/random';
import { candiesUntilNextGift, computeSessionRewards, giftsAvailable, pickGiftSticker } from '../src/engine/RewardService';
import { computeScore, scoreQuiz } from '../src/engine/ScoringService';
import type { Question } from '../src/engine/types';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

/** Trả lời một câu: chọn các đáp án sai trong `wrongFirst` rồi chọn đúng. */
function play(state: QuizSessionState, wrongFirst: number): QuizSessionState {
  let s = state;
  const q = s.questions[s.currentIndex]!;
  const wrongs = q.options.filter((o) => o !== q.correctAnswer).slice(0, wrongFirst);
  for (const w of wrongs) {
    s = answerQuestion(s, w);
    expect(s.phase).toBe('wrong');
    s = retryQuestion(s);
  }
  s = answerQuestion(s, q.correctAnswer);
  expect(s.phase).toBe('correct');
  return nextQuestion(s);
}

describe('Hệ thống đăng ký chương', () => {
  it('có đúng 2 chương được bật, đúng mã chương', () => {
    expect(CHAPTERS.filter((c) => c.enabled).map((c) => c.id)).toEqual(['number-recognition', 'object-counting']);
    expect(getChapter('number-recognition')).toBe(numberRecognitionChapter);
    expect(getChapter('khong-ton-tai')).toBeUndefined();
  });
});

describe('Chương 1 – Làm quen mặt số', () => {
  it('có đủ 10 thẻ số 1–10, có hình minh họa và âm thanh', () => {
    expect(NUMBER_CARDS.map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const card of NUMBER_CARDS) {
      expect(getObject(card.objectId)).toBeDefined();
      expect(existsSync(join(PUBLIC, `assets/sounds/numbers/${card.value}.m4a`))).toBe(true);
      expect(existsSync(join(PUBLIC, `assets/sounds/cards/${card.value}.m4a`))).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: 10 câu, không trùng, 4 đáp án, 1 đáp án đúng', (seed) => {
    const qs = generateQuiz(numberRecognitionChapter, createSeededRng(seed));
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.payload.number)).size).toBe(10);
    for (const q of qs) {
      expect(q.type).toBe('number-recognition');
      expect(q.correctAnswer).toBe(q.payload.number);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options.filter((o) => o === q.correctAnswer)).toHaveLength(1);
      expect(q.options.every((o) => o >= 1 && o <= 10)).toBe(true);
    }
  });

  it('xáo trộn vị trí đáp án đúng', () => {
    const positions = new Set<number>();
    for (const seed of SEEDS) {
      for (const q of generateQuiz(numberRecognitionChapter, createSeededRng(seed))) {
        positions.add(q.options.indexOf(q.correctAnswer));
      }
    }
    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('Chương 2 – Bé tập đếm', () => {
  it('thư viện có khoảng 100 hình, id không trùng, đủ 5 nhóm và đủ file ảnh + âm thanh', () => {
    expect(OBJECTS.length).toBeGreaterThanOrEqual(95);
    expect(new Set(OBJECTS.map((o) => o.id)).size).toBe(OBJECTS.length);
    expect(new Set(OBJECTS.map((o) => o.category))).toEqual(new Set(['animal', 'plant', 'flower', 'fruit', 'thing']));
    const missing = OBJECTS.filter(
      (o) =>
        !existsSync(join(PUBLIC, `assets/images/objects/${o.id}.svg`)) ||
        !existsSync(join(PUBLIC, `assets/sounds/questions/count-${o.id}.m4a`)),
    );
    expect(missing.map((m) => m.id)).toEqual([]);
  });

  it.each(SEEDS)('seed %i: 10 câu, số lượng 1–10, đáp án hợp lệ, hình không trùng', (seed) => {
    const qs = generateQuiz(objectCountingChapter, createSeededRng(seed));
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.id)).size).toBe(10);
    expect(new Set(qs.map((q) => q.payload.objectId)).size).toBe(10);
    for (const q of qs) {
      expect(q.payload.count).toBeGreaterThanOrEqual(1);
      expect(q.payload.count).toBeLessThanOrEqual(10);
      expect(q.correctAnswer).toBe(q.payload.count);
      expect(getObject(q.payload.objectId)).toBeDefined();
      expect(q.prompt).toBe(`Có bao nhiêu ${getObject(q.payload.objectId)!.label}?`);
      expect(areOptionsValid(q.options, q.correctAnswer, 4)).toBe(true);
    }
  });

  it('sinh đủ mọi số lượng từ 1 đến 10 qua nhiều bài', () => {
    const counts = new Set<number>();
    for (const seed of SEEDS) for (const q of generateQuiz(objectCountingChapter, createSeededRng(seed))) counts.add(q.payload.count);
    expect([...counts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('AnswerGenerator', () => {
  it('luôn chứa đáp án đúng, không trùng, trong phạm vi – với mọi đáp án 1–10', () => {
    for (let correct = 1; correct <= 10; correct++) {
      for (const seed of SEEDS.slice(0, 50)) {
        const options = generateNumericOptions({ correct, range: { min: 1, max: 10 }, count: 4, rng: createSeededRng(seed) });
        expect(areOptionsValid(options, correct, 4)).toBe(true);
        expect(options.every((o) => o >= 1 && o <= 10)).toBe(true);
      }
    }
  });

  it('báo lỗi khi đáp án nằm ngoài phạm vi', () => {
    expect(() => generateNumericOptions({ correct: 11, range: { min: 1, max: 10 }, count: 4, rng: Math.random })).toThrow();
  });
});

describe('QuizSession + ScoringService', () => {
  const questions = generateQuiz(numberRecognitionChapter, createSeededRng(42)) as Question[];

  it('chấm điểm theo lần trả lời đầu tiên: sai rồi đúng vẫn tính sai', () => {
    let s = createQuizSession({ sessionId: null, chapterId: 'number-recognition', questions });
    s = play(s, 1); // câu 1: sai trước
    for (let i = 1; i < 10; i++) s = play(s, 0);
    expect(s.phase).toBe('finished');
    const score = scoreQuiz(s.questions, s.records);
    expect(score).toMatchObject({ correctAnswers: 9, incorrectAnswers: 1, score: 9, percent: 90, isPerfectScore: false });
    // Không tính mỗi lần thử lại thành câu hỏi riêng
    expect(score.totalQuestions).toBe(10);
  });

  it('cho phép trả lời lại, làm mờ đáp án sai đã chọn, không chọn lại được', () => {
    let s = createQuizSession({ sessionId: null, chapterId: 'number-recognition', questions });
    const q = s.questions[0]!;
    const wrong = q.options.find((o) => o !== q.correctAnswer)!;
    s = answerQuestion(s, wrong);
    expect(s.phase).toBe('wrong');
    // Đang hiển thị phản hồi => bấm tiếp bị bỏ qua (chống bấm liên tục)
    expect(answerQuestion(s, q.correctAnswer)).toBe(s);
    s = retryQuestion(s);
    expect(getTriedWrongOptions(s)).toEqual([wrong]);
    expect(answerQuestion(s, wrong)).toBe(s);
    s = answerQuestion(s, q.correctAnswer);
    expect(s.phase).toBe('correct');
    expect(s.records[0]!.attempts).toEqual([wrong, q.correctAnswer]);
  });

  it('10/10 khi đúng ngay lần đầu tất cả các câu', () => {
    let s = createQuizSession({ sessionId: null, chapterId: 'number-recognition', questions });
    for (let i = 0; i < 10; i++) s = play(s, 0);
    expect(scoreQuiz(s.questions, s.records)).toMatchObject({ score: 10, isPerfectScore: true, percent: 100 });
    const evaluation = evaluateSubmission(s.questions, toSubmission(s).answers);
    expect(evaluation.ok && evaluation.score.isPerfectScore).toBe(true);
  });

  it('computeScore làm tròn thang 10', () => {
    expect(computeScore(7, 10)).toMatchObject({ score: 7, percent: 70, incorrectAnswers: 3 });
    expect(computeScore(0, 10).score).toBe(0);
  });
});

describe('evaluateSubmission (server không tin client)', () => {
  const qs = generateQuiz(numberRecognitionChapter, createSeededRng(7)) as Question[];
  const perfect = qs.map((q) => ({ questionId: q.id, attempts: [q.correctAnswer] }));

  it('chấp nhận bài hợp lệ', () => {
    expect(evaluateSubmission(qs, perfect).ok).toBe(true);
  });
  it('từ chối thiếu câu, sai thứ tự, đáp án lạ, lặp lại, chưa trả lời đúng', () => {
    expect(evaluateSubmission(qs, perfect.slice(1)).ok).toBe(false);
    expect(evaluateSubmission(qs, [...perfect].reverse()).ok).toBe(false);
    const q0 = qs[0]!;
    const wrong = q0.options.find((o) => o !== q0.correctAnswer)!;
    const outside = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((n) => !q0.options.includes(n))!;
    const mutate = (attempts: number[]) => [{ questionId: q0.id, attempts }, ...perfect.slice(1)];
    expect(evaluateSubmission(qs, mutate([outside, q0.correctAnswer])).ok).toBe(false);
    expect(evaluateSubmission(qs, mutate([wrong, wrong, q0.correctAnswer])).ok).toBe(false);
    expect(evaluateSubmission(qs, mutate([wrong])).ok).toBe(false);
    expect(evaluateSubmission(qs, mutate([q0.correctAnswer, wrong])).ok).toBe(false);
    expect(evaluateSubmission(qs, mutate([])).ok).toBe(false);
  });
});

describe('RewardService', () => {
  const base = {
    sessionId: 's1',
    chapterId: 'number-recognition',
    chapterRewards: numberRecognitionChapter.rewards,
    completedQuizzesAfter: 2,
    perfectSessionsAfter: 1,
  };
  it('10/10 nhận đúng 1 viên kẹo (mặc định) + sticker lần đầu của chương', () => {
    const grants = computeSessionRewards({ ...base, score: { isPerfectScore: true } });
    expect(grants.filter((g) => g.rewardType === 'candy')).toEqual([
      expect.objectContaining({ quantity: 1, dedupeKey: 'session:s1:candy' }),
    ]);
    expect(grants.some((g) => g.dedupeKey === 'achievement:first-perfect:number-recognition')).toBe(true);
  });
  it('không đạt 10/10 thì không có kẹo', () => {
    const grants = computeSessionRewards({ ...base, score: { isPerfectScore: false } });
    expect(grants.some((g) => g.rewardType === 'candy')).toBe(false);
  });
  it('số kẹo có thể cấu hình theo chương', () => {
    const grants = computeSessionRewards({
      ...base,
      chapterRewards: { candiesForPerfect: 3 },
      score: { isPerfectScore: true },
    });
    expect(grants.find((g) => g.rewardType === 'candy')?.quantity).toBe(3);
  });
  it('hộp quà: đủ 10 kẹo mở 1 hộp', () => {
    expect(giftsAvailable(9, 0)).toBe(0);
    expect(giftsAvailable(10, 0)).toBe(1);
    expect(giftsAvailable(25, 1)).toBe(1);
    expect(giftsAvailable(25, 2)).toBe(0);
    expect(candiesUntilNextGift(13, 1)).toBe(7);
  });
  it('quà ưu tiên sticker chưa có', () => {
    const pool = ['a', 'b', 'c'];
    for (const seed of SEEDS.slice(0, 20)) expect(pickGiftSticker(['a', 'b'], createSeededRng(seed), pool)).toBe('c');
    expect(pool).toContain(pickGiftSticker(pool, Math.random, pool));
  });
  it('mọi sticker được tham chiếu đều tồn tại và có ảnh', () => {
    const codes = new Set(STICKERS.map((s) => s.code));
    for (const c of CHAPTERS) if (c.rewards.firstPerfectSticker) expect(codes.has(c.rewards.firstPerfectSticker)).toBe(true);
    for (const s of STICKERS) expect(existsSync(join(PUBLIC, `assets/rewards/stickers/${s.code}.svg`))).toBe(true);
  });
});
