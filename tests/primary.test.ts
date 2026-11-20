/**
 * Nhóm 5–9 tuổi: câu tự gõ (bàn phím số), bộ sinh đề Tính nhẩm & Tư duy toán.
 */
import { describe, expect, it } from 'vitest';
import { getLevels } from '../src/chapters/levels';
import { MENTAL_ROOT_ID, primaryChapters, THINK_HUB_ID } from '../src/chapters/primary/config';
import { speechOfPrimary, stepNumberChoices, type PrimaryPayload } from '../src/chapters/primary/kit';
import { MENTAL_STAGES } from '../src/chapters/primary/mental';
import { PRIMARY_TOPICS } from '../src/chapters/primary/topics';
import { evaluateSubmission, generateQuiz, MAX_INPUT_ATTEMPTS, validateQuestionSet } from '../src/engine/QuizEngine';
import { answerQuestion, createQuizSession, retryQuestion } from '../src/engine/QuizSession';
import { createSeededRng } from '../src/engine/random';
import type { Question } from '../src/engine/types';


const inputQ = (id: string, a: number): Question => ({ id, type: 't', prompt: '', payload: {}, correctAnswer: a, options: [], input: true });

describe('Câu tự gõ đáp án', () => {
  it('hợp lệ khi không có phương án và đáp án là số nguyên không âm', () => {
    expect(validateQuestionSet([inputQ('a', 12)], 1, 4)).toBeNull();
    expect(validateQuestionSet([{ ...inputQ('a', 12), options: [12, 13] }], 1, 4)).toMatch(/tự gõ/);
    expect(validateQuestionSet([inputQ('a', -1)], 1, 4)).toMatch(/tự gõ/);
    expect(validateQuestionSet([inputQ('a', 1.5)], 1, 4)).toMatch(/tự gõ/);
  });

  it('chấm theo lần gõ đầu; số sai bất kỳ được chấp nhận, số không hợp lệ bị từ chối', () => {
    const qs = [inputQ('a', 15), inputQ('b', 8)];
    const r = evaluateSubmission(qs, [
      { questionId: 'a', attempts: [14, 51, 15] },
      { questionId: 'b', attempts: [8] },
    ]);
    expect(r.ok && r.score.correctAnswers).toBe(1);
    expect(r.ok && r.answers[0]!.selectedAnswer).toBe(14);
    const bad = (attempts: number[]) => evaluateSubmission([inputQ('a', 15)], [{ questionId: 'a', attempts }]);
    expect(bad([1.5, 15]).ok).toBe(false);
    expect(bad([-3, 15]).ok).toBe(false);
    expect(bad([14, 14, 15]).ok).toBe(false);
    expect(bad([14]).ok).toBe(false);
    expect(bad([...Array.from({ length: MAX_INPUT_ATTEMPTS }, (_, i) => 100 + i), 15]).ok).toBe(false);
  });

  it('QuizSession nhận số bất kỳ cho câu tự gõ, bỏ qua số sai đã thử', () => {
    let s = createQuizSession({ sessionId: null, chapterId: 'x', questions: [inputQ('a', 15)] });
    s = answerQuestion(s, 14);
    expect(s.phase).toBe('wrong');
    s = retryQuestion(s);
    expect(answerQuestion(s, 14)).toBe(s);
    expect(answerQuestion(s, 2.5)).toBe(s);
    s = answerQuestion(s, 15);
    expect(s.phase).toBe('correct');
  });
});

type PQ = Question<PrimaryPayload>;

/** Sinh rất nhiều bài để soát mọi dạng câu hỏi. */
function sampleAll(chapterId: string, seeds = 120): PQ[] {
  const chapter = primaryChapters.find((c) => c.id === chapterId)!;
  return Array.from({ length: seeds }, (_, s) => generateQuiz(chapter, createSeededRng(s + 1)) as PQ[]).flat();
}

describe('Nhóm 5–9 tuổi – cấu trúc', () => {
  it('Tính nhẩm 6 cấp, mỗi chủ đề tư duy 3 cấp; mọi chương thuộc nhóm primary', () => {
    expect(getLevels(MENTAL_ROOT_ID).map((l) => l.games[0]!.game?.name)).toEqual(MENTAL_STAGES.map((s) => s.name));
    for (const t of PRIMARY_TOPICS) {
      const levels = getLevels(`pm-${t.id}`);
      expect(levels.map((l) => l.level)).toEqual([1, 2, 3]);
    }
    expect(primaryChapters.every((c) => c.ageGroup === 'primary')).toBe(true);
    expect(primaryChapters.find((c) => c.id === THINK_HUB_ID)?.hubOnly).toBe(true);
    // Thưởng bằng xu, không kẹo / sticker.
    for (const c of primaryChapters) expect(c.rewards).toEqual({ candiesForPerfect: 0 });
  });
});

describe('Nhóm 5–9 tuổi – bộ sinh đề', () => {
  const playable = primaryChapters.filter((c) => !c.hubOnly);

  it.each(playable.map((c) => [c.id]))('%s: đề hợp lệ, có gợi ý từng bước và bước cuối ra đúng đáp án', (id) => {
    for (const q of sampleAll(id)) {
      const p = q.payload;
      const all = JSON.stringify(p) + q.prompt;
      expect(all).not.toMatch(/undefined|NaN|null,null/);
      expect(Number.isInteger(q.correctAnswer)).toBe(true);
      expect(p.steps?.length ?? 0).toBeGreaterThan(0);
      for (const st of p.steps!) {
        expect(Number.isInteger(st.a) && st.a >= 0).toBe(true);
        if (st.choices) expect(st.a).toBeLessThan(st.choices.length);
      }
      if (q.input) {
        expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
        const last = p.steps!.at(-1)!;
        if (!last.choices) expect(last.a).toBe(q.correctAnswer);
      } else {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.options.length).toBeLessThanOrEqual(4);
        const labels = q.options.map((o) => p.choices?.[String(o)]);
        expect(labels.every(Boolean)).toBe(true);
        expect(new Set(labels).size).toBe(labels.length);
      }
      expect(speechOfPrimary(q).length).toBeGreaterThan(3);
    }
  });

  it('Tính nhẩm: phép tính hiển thị khớp đáp án', () => {
    const calc = (eq: string, x: number) => {
      const m = eq.replace('□', String(x)).match(/^(\d+) ([+−]) (\d+) = (\d+)$/);
      expect(m, eq).not.toBeNull();
      const [, a, op, b, c] = m!;
      return (op === '+' ? Number(a) + Number(b) : Number(a) - Number(b)) === Number(c);
    };
    for (const stage of primaryChapters.filter((c) => c.id.startsWith(MENTAL_ROOT_ID))) {
      for (const q of sampleAll(stage.id, 60)) expect(calc(q.payload.eq!, q.correctAnswer), q.payload.eq).toBe(true);
    }
  });

  it('phương án gợi ý dạng số luôn chứa đáp án, không âm, không trùng', () => {
    for (let a = 0; a < 300; a += 7) {
      const c = stepNumberChoices(a, `s${a}`);
      expect(c).toContain(a);
      expect(new Set(c).size).toBe(c.length);
      expect(c.every((x) => x >= 0)).toBe(true);
    }
  });
});
