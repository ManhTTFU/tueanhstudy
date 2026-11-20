import { describe, expect, it } from 'vitest';
import { getLevels, isChapterUnlocked, LEVEL_UNLOCK_MIN_SCORE } from '../src/chapters/levels';
import { ARITHMETIC_LEVELS } from '../src/chapters/arithmetic/config';
import { dadaChapters, TOPICS } from '../src/chapters/dada/config';
import { speechFile, speechOf, type DadaPayload, type Visual } from '../src/chapters/dada/kit';
import { mazePath } from '../src/chapters/dada/topics/maze';
import { arithmeticSpeech, arithmeticVoiceFile, OPERATIONS } from '../src/chapters/arithmetic/operations';
import { primaryChapters } from '../src/chapters/primary/config';
import { PRIMARY_TOPICS } from '../src/chapters/primary/topics';
import { CHAPTERS, getChapter, getHomeChapters, getHubChapters, getSubGames } from '../src/chapters/registry';
import { numberRecognitionChapter } from '../src/chapters/number-recognition/config';
import { objectCountingChapter } from '../src/chapters/object-counting/config';
import { findNumberPrompt, NUMBER_CARDS, numberWord } from '../src/data/numbers/numbers';
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
  it('các chương được bật, đúng mã chương; trang chủ chỉ hiện 2 chương gốc', () => {
    const levelIds = Array.from({ length: 9 }, (_, i) => [`number-recognition-${i * 10 + 11}-${i * 10 + 20}`, `number-finding-${i * 10 + 11}-${i * 10 + 20}`]).flat();
    expect(CHAPTERS.filter((c) => c.enabled).map((c) => c.id)).toEqual(['number-recognition', 'object-counting', 'number-finding', ...levelIds, 'arithmetic', 'arithmetic-sub-5', 'arithmetic-add-10', 'arithmetic-sub-10', 'brain', ...dadaChapters.map((c) => c.id), ...primaryChapters.map((c) => c.id)]);
    expect(getHomeChapters().map((c) => c.id)).toEqual(['number-recognition', 'object-counting', 'arithmetic', 'brain']);
    expect(getHomeChapters('preschool')).toEqual(getHomeChapters());
    // Nhóm 5–9 tuổi: Tính nhẩm + cửa vào Tư duy toán (7 chủ đề bên trong)
    expect(getHomeChapters('primary').map((c) => c.id)).toEqual(['pm-mental', 'pm-think']);
    expect(getHubChapters('pm-think').map((c) => c.id)).toEqual(PRIMARY_TOPICS.map((t) => `pm-${t.id}`));
    // 11 chủ đề tư duy nằm trong trang "Sân chơi trí tuệ"
    expect(getHubChapters('brain').map((c) => c.id)).toEqual(TOPICS.map((t) => `dd-${t.id}`));
    expect(getSubGames('number-recognition').map((c) => c.id)).toEqual(['number-finding', ...levelIds]);
    expect(getChapter('number-recognition')).toBe(numberRecognitionChapter);
    expect(getChapter('khong-ton-tai')).toBeUndefined();
  });
});

describe('Đọc số tiếng Việt', () => {
  it('đọc đúng các trường hợp đặc biệt', () => {
    expect(numberWord(5)).toBe('Năm');
    expect(numberWord(10)).toBe('Mười');
    expect(numberWord(11)).toBe('Mười một');
    expect(numberWord(14)).toBe('Mười bốn');
    expect(numberWord(15)).toBe('Mười lăm');
    expect(numberWord(20)).toBe('Hai mươi');
    expect(numberWord(21)).toBe('Hai mươi mốt');
    expect(numberWord(24)).toBe('Hai mươi tư');
    expect(numberWord(25)).toBe('Hai mươi lăm');
    expect(numberWord(30)).toBe('Ba mươi');
    expect(numberWord(99)).toBe('Chín mươi chín');
    expect(numberWord(41)).toBe('Bốn mươi mốt');
    expect(numberWord(55)).toBe('Năm mươi lăm');
    expect(numberWord(100)).toBe('Một trăm');
    expect(findNumberPrompt(15)).toBe('Đâu là số mười lăm?');
  });

  it('thẻ 11–100 dạy theo chục và đơn vị', () => {
    expect(NUMBER_CARDS.find((c) => c.value === 47)).toMatchObject({ word: 'Bốn mươi bảy', caption: 'Bốn chục và bảy' });
    expect(NUMBER_CARDS.find((c) => c.value === 90)).toMatchObject({ caption: 'Chín chục' });
    expect(NUMBER_CARDS.find((c) => c.value === 100)).toMatchObject({ word: 'Một trăm', caption: 'Mười chục là một trăm' });
    expect(NUMBER_CARDS.find((c) => c.value === 13)).toMatchObject({ word: 'Mười ba', caption: 'Một chục và ba' });
    expect(NUMBER_CARDS.find((c) => c.value === 20)).toMatchObject({ word: 'Hai mươi', caption: 'Hai chục' });
  });
});

describe('Cấp độ & mở khoá', () => {
  const scores = (map: Record<string, number>) => (id: string) => map[id] ?? 0;

  it('Làm quen mặt số có 10 cấp từ 1–10 đến 91–100, mỗi cấp 2 trò (Nhìn số trước Tìm số)', () => {
    const levels = getLevels('number-recognition');
    expect(levels.map((l) => l.label)).toEqual(['1–10', '11–20', '21–30', '31–40', '41–50', '51–60', '61–70', '71–80', '81–90', '91–100']);
    expect(levels[0]!.games.map((g) => g.id)).toEqual(['number-recognition', 'number-finding']);
    expect(levels[1]!.games.map((g) => g.id)).toEqual(['number-recognition-11-20', 'number-finding-11-20']);
    for (const l of levels) expect(l.games.map((g) => g.game?.name)).toEqual(['Nhìn số', 'Tìm số']);
    // Sticker 10/10 lần đầu của mọi trò đều khác nhau.
    const stickers = levels.flatMap((l) => l.games.map((g) => g.rewards.firstPerfectSticker));
    expect(new Set(stickers).size).toBe(stickers.length);
    expect(getLevels('object-counting')).toHaveLength(1);
  });

  it('cấp 1 luôn mở; cấp 11–20 cần >= 8 điểm ở CẢ HAI trò cấp 1–10', () => {
    const lv2 = getChapter('number-finding-11-20')!;
    expect(isChapterUnlocked(getChapter('number-finding')!, scores({}))).toBe(true);
    expect(isChapterUnlocked(lv2, scores({}))).toBe(false);
    expect(isChapterUnlocked(lv2, scores({ 'number-recognition': 10 }))).toBe(false);
    expect(isChapterUnlocked(lv2, scores({ 'number-recognition': 10, 'number-finding': 7 }))).toBe(false);
    expect(isChapterUnlocked(lv2, scores({ 'number-recognition': LEVEL_UNLOCK_MIN_SCORE, 'number-finding': LEVEL_UNLOCK_MIN_SCORE }))).toBe(true);
    // Mỗi cấp chỉ phụ thuộc cấp ngay trước: 91–100 cần 81–90, không cần đạt lại 1–10.
    const lv10 = getChapter('number-recognition-91-100')!;
    expect(isChapterUnlocked(lv10, scores({ 'number-recognition-81-90': 8, 'number-finding-81-90': 9 }))).toBe(true);
    expect(isChapterUnlocked(lv10, scores({ 'number-recognition-81-90': 8, 'number-finding-81-90': 7, 'number-recognition': 10, 'number-finding': 10 }))).toBe(false);
  });

  it('câu hỏi mỗi cấp chỉ dùng số trong cấp, mỗi số 1 lần, có giọng đọc', () => {
    for (const level of getLevels('number-recognition')) {
      for (const chapter of level.games) {
        const { min, max } = chapter.range;
        const qs = generateQuiz(chapter);
        expect(qs.map((q) => q.correctAnswer).sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => i + min));
        for (const q of qs) for (const o of q.options) expect(o >= min && o <= max).toBe(true);
      }
    }
    for (let n = 1; n <= 100; n++) {
      expect(existsSync(join(PUBLIC, `assets/sounds/cards/${n}.m4a`))).toBe(true);
      expect(existsSync(join(PUBLIC, `assets/sounds/numbers/${n}.m4a`))).toBe(true);
      expect(existsSync(join(PUBLIC, `assets/sounds/questions/find-${n}.m4a`))).toBe(true);
    }
  });
});

describe('Cộng trừ bằng hình', () => {
  it('2 cấp "Phạm vi 5" và "Phạm vi 10", mỗi cấp Phép cộng + Phép trừ', () => {
    const levels = getLevels('arithmetic');
    expect(levels.map((l) => [l.label, l.games.map((g) => g.id)])).toEqual([
      ['Phạm vi 5', ['arithmetic', 'arithmetic-sub-5']],
      ['Phạm vi 10', ['arithmetic-add-10', 'arithmetic-sub-10']],
    ]);
    expect(levels.flatMap((l) => l.games.map((g) => g.game?.name))).toEqual(['Phép cộng', 'Phép trừ', 'Phép cộng', 'Phép trừ']);
    expect(getChapter('arithmetic-sub-10')!.fullName).toBe('Phép trừ phạm vi 10');
  });

  it('cặp số hợp lệ: cộng a,b >= 1; trừ còn lại >= 1; phạm vi 10 chỉ lấy phép tính có số > 5', () => {
    const [lv5, lv10] = ARITHMETIC_LEVELS;
    expect(OPERATIONS.add.pairs(lv5!)).toHaveLength(10);
    expect(OPERATIONS.sub.pairs(lv5!)).toHaveLength(10);
    for (const [a, b] of OPERATIONS.add.pairs(lv10!)) expect(a >= 1 && b >= 1 && a + b > 5 && a + b <= 10).toBe(true);
    for (const [a, b] of OPERATIONS.sub.pairs(lv10!)) expect(a > 5 && a <= 10 && b >= 1 && a - b >= 1).toBe(true);
    expect(arithmeticSpeech('add', 2, 3)).toBe('Hai cộng ba bằng mấy?');
    expect(arithmeticSpeech('sub', 10, 5)).toBe('Mười trừ năm bằng mấy?');
  });

  it('mỗi bài: 10 phép tính khác nhau, đáp án đúng, 4 phương án trong phạm vi, mỗi câu 1 hình khác nhau, có giọng đọc', () => {
    for (const level of getLevels('arithmetic')) {
      for (const chapter of level.games) {
        for (let run = 0; run < 20; run++) {
          const qs = generateQuiz(chapter) as Question<{ op: 'add' | 'sub'; a: number; b: number; objectId: string }>[];
          expect(qs).toHaveLength(10);
          expect(new Set(qs.map((q) => q.id)).size).toBe(10);
          expect(new Set(qs.map((q) => q.payload.objectId)).size).toBe(10);
          for (const q of qs) {
            const { op, a, b } = q.payload;
            expect(q.correctAnswer).toBe(OPERATIONS[op].compute(a, b));
            expect(q.prompt).toBe(`${a} ${OPERATIONS[op].symbol} ${b} = ?`);
            expect(q.options).toHaveLength(4);
            expect(q.options.filter((o) => o === q.correctAnswer)).toHaveLength(1);
            for (const o of q.options) expect(o >= chapter.range.min && o <= chapter.range.max).toBe(true);
            expect(getObject(q.payload.objectId)).toBeDefined();
          }
        }
      }
    }
    for (const level of ARITHMETIC_LEVELS) {
      for (const op of ['add', 'sub'] as const) {
        for (const [a, b] of OPERATIONS[op].pairs(level)) {
          expect(existsSync(join(PUBLIC, `assets/sounds/${arithmeticVoiceFile(op, a, b)}.m4a`))).toBe(true);
        }
      }
    }
  });
});

describe('Sân chơi tư duy (11 chủ đề)', () => {
  type DQ = Question<DadaPayload>;
  const run = (id: string, n = 40) => Array.from({ length: n }, () => generateQuiz(getChapter(id)!) as DQ[]).flat();

  it('11 chủ đề, mỗi chủ đề 4–6 cấp nối tiếp nhau, sticker ở cấp cuối', () => {
    expect(TOPICS.map((t) => t.name)).toEqual(['Màu sắc', 'Hình khối', 'Đếm số', 'Toán vui', 'So sánh', 'Phân loại', 'Quan sát', 'Quy luật', 'Mê cung', 'Chữ cái', 'Thời gian']);
    for (const t of TOPICS) {
      const levels = getLevels(`dd-${t.id}`);
      expect(levels).toHaveLength(t.levels.length);
      expect(t.levels.length).toBeGreaterThanOrEqual(4);
      expect(levels.at(-1)!.games[0]!.rewards.firstPerfectSticker).toBe(t.sticker);
      expect(isChapterUnlocked(levels[1]!.games[0]!, () => 0)).toBe(false);
    }
  });

  it('mọi cấp: 10 câu id khác nhau, phương án hợp lệ, có giọng đọc', () => {
    for (const c of dadaChapters) {
      for (let r = 0; r < 25; r++) {
        const qs = generateQuiz(c) as DQ[];
        expect(qs).toHaveLength(10);
        expect(new Set(qs.map((q) => q.id)).size).toBe(10);
        for (const q of qs) {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.options.filter((o) => o === q.correctAnswer)).toHaveLength(1);
          if (q.payload.choices) expect(Object.keys(q.payload.choices).map(Number).sort()).toEqual([...q.options].sort());
          expect(existsSync(join(PUBLIC, `assets/sounds/${speechFile(speechOf(q))}.m4a`))).toBe(true);
        }
      }
    }
  });

  it('mê cung: đúng một bạn có đường tới đích, và đó là đáp án', () => {
    for (const id of ['dd-maze', 'dd-maze-2', 'dd-maze-3', 'dd-maze-5']) {
      for (const q of run(id, 15)) {
        const maze = q.payload.blocks.find((b) => b.t === 'maze');
        if (!maze || maze.t !== 'maze') continue;
        const goal = Number(Object.entries(maze.marks).find(([, v]) => v.t === 'emoji' && !v.n)![0]);
        const runners = Object.entries(maze.marks).filter(([, v]) => v.t === 'emoji' && v.n);
        const reach = runners.filter(([cell]) => mazePath(maze.open, maze.w, Number(cell), goal));
        expect(reach).toHaveLength(1);
        const ans = q.payload.choices![String(q.correctAnswer)] as Extract<Visual, { t: 'emoji' }>;
        expect((reach[0]![1] as Extract<Visual, { t: 'emoji' }>).e).toBe(ans.e);
      }
    }
  });

  it('bảng 3×3 và sudoku 4×4: điền đáp án vào ô trống thì mỗi hàng, cột (và ô vuông nhỏ) đều đủ', () => {
    for (const id of ['dd-patterns-4', 'dd-patterns-5']) {
      for (const q of run(id, 20)) {
        const grid = q.payload.blocks[0]!;
        if (grid.t !== 'grid') throw new Error('cần lưới');
        const n = grid.cols;
        const ans = (q.payload.choices![String(q.correctAnswer)] as { e: string }).e;
        const cells = grid.cells.map((v) => (v.t === 'q' ? ans : (v as { e: string }).e));
        for (let i = 0; i < n; i++) {
          expect(new Set(cells.slice(i * n, i * n + n)).size).toBe(n);
          expect(new Set(cells.filter((_, k) => k % n === i)).size).toBe(n);
        }
        if (n === 4) for (const [r, c] of [[0, 0], [0, 2], [2, 0], [2, 2]]) expect(new Set([cells[r! * 4 + c!], cells[r! * 4 + c! + 1], cells[(r! + 1) * 4 + c!], cells[(r! + 1) * 4 + c! + 1]]).size).toBe(4);
      }
    }
  });

  it('một số dạng bài kiểm tra đáp án trực tiếp', () => {
    for (const q of run('dd-time-6', 5)) {
      const clock = q.payload.blocks[0]!;
      if (clock.t !== 'row' || clock.items[0]!.t !== 'clock') throw new Error('cần đồng hồ');
      expect((q.payload.choices![String(q.correctAnswer)] as { v: string }).v).toBe(`${clock.items[0]!.h} giờ`);
    }
    for (const q of run('dd-math-3', 5)) {
      const row = q.payload.blocks[0]!;
      if (row.t !== 'row') throw new Error('cần dãy số');
      const nums = row.items.map((v) => (v.t === 'text' ? Number(v.v) : null));
      const i = nums.indexOf(null);
      const known = nums.find((x, k) => x !== null && k !== i)!;
      expect(q.correctAnswer).toBe(known + (i - nums.indexOf(known)));
    }
    for (const q of run('dd-counting-2', 5)) {
      const grid = q.payload.blocks[0]!;
      if (grid.t !== 'grid') throw new Error('cần lưới');
      const target = q.prompt;
      const counts = new Map<string, number>();
      for (const v of grid.cells) counts.set((v as { e: string }).e, (counts.get((v as { e: string }).e) ?? 0) + 1);
      expect([...counts.values()]).toContain(q.correctAnswer);
      expect(target).toMatch(/^Có bao nhiêu /);
    }
    for (const q of run('dd-letters', 5)) expect(q.payload.say).toMatch(/^Đâu là chữ /);
  });
});

describe('Sân chơi trí tuệ', () => {
  type BP = import('../src/chapters/brain/generators').BrainPayload;
  const quiz = (id: string) => generateQuiz(getChapter(id)!) as Question<BP>[];
  const cat = (id: string) => getObject(id)!.category;

  it('thẻ "Sân chơi trí tuệ" chỉ là cửa vào 11 chủ đề; 5 trò kỹ năng cũ đã tắt (giữ để hiện lịch sử cũ)', () => {
    expect(getChapter('brain')).toMatchObject({ enabled: true, hubOnly: true });
    for (const id of ['brain-attention', 'brain-logic', 'brain-memory', 'brain-imagine']) expect(getChapter(id)!.enabled).toBe(false);
    expect(getSubGames('brain')).toEqual([]);
    expect(getHubChapters('brain')).toHaveLength(11);
  });

  it('mọi câu: 10 câu không trùng, 4 phương án không trùng có đúng 1 đáp án, hình tồn tại', () => {
    for (const g of getLevels('brain')[0]!.games) {
      for (let run = 0; run < 30; run++) {
        const qs = quiz(g.id);
        expect(qs).toHaveLength(10);
        expect(new Set(qs.map((q) => q.id)).size).toBe(10);
        for (const q of qs) {
          expect(areOptionsValid(q.options, q.correctAnswer, 4)).toBe(true);
          const p = q.payload;
          if ('choices' in p) {
            expect(Object.keys(p.choices).map(Number).sort()).toEqual([...q.options].sort());
            for (const id of Object.values(p.choices)) expect(getObject(id)).toBeDefined();
          }
        }
      }
    }
  });

  it('đáp án đúng theo từng kỹ năng', () => {
    for (let run = 0; run < 30; run++) {
      for (const q of quiz('brain')) {
        const p = q.payload as Extract<BP, { kind: 'observe' }>;
        expect(p.choices[String(q.correctAnswer)]).toBe(p.target);
      }
      for (const q of quiz('brain-imagine')) {
        const p = q.payload as Extract<BP, { kind: 'silhouette' }>;
        expect(p.choices[String(q.correctAnswer)]).toBe(p.target);
      }
      for (const q of quiz('brain-attention')) {
        const p = q.payload as Extract<BP, { kind: 'attention' }>;
        expect(p.grid.filter((id) => id === p.target)).toHaveLength(q.correctAnswer);
        expect(p.grid.length).toBeGreaterThan(q.correctAnswer);
        expect(q.prompt).toBe(`Có bao nhiêu ${p.label}?`);
      }
      for (const q of quiz('brain-logic')) {
        const p = q.payload;
        if (p.kind === 'pattern') {
          const seq = p.sequence;
          const period = [2, 3].find((n) => seq.every((id, i) => i < n || id === seq[i - n]))!;
          expect(period).toBeDefined();
          expect(p.choices[String(q.correctAnswer)]).toBe(seq[seq.length - period]);
        } else if (p.kind === 'odd') {
          const ids = Object.values(p.choices);
          const odd = p.choices[String(q.correctAnswer)]!;
          const rest = ids.filter((id) => id !== odd);
          expect(new Set(rest.map(cat)).size).toBe(1);
          expect(cat(odd)).not.toBe(cat(rest[0]!));
        } else throw new Error('Tư duy chỉ có quy luật / khác loại');
      }
      for (const q of quiz('brain-memory')) {
        const p = q.payload as Extract<BP, { kind: 'memory' }>;
        expect(p.shown).toHaveLength(3);
        for (const [v, id] of Object.entries(p.choices)) expect(p.shown.includes(id)).toBe(Number(v) === q.correctAnswer);
      }
    }
    for (const f of ['brain-observe', 'brain-pattern', 'brain-odd', 'brain-memory-look', 'brain-memory-ask', 'brain-silhouette', 'chapter-brain']) {
      expect(existsSync(join(PUBLIC, `assets/sounds/phrases/${f}.m4a`))).toBe(true);
    }
  });
});

describe('Trò chơi phụ – Tìm số', () => {
  it('hỏi "Đâu là số ...?", 10 câu không trùng, đáp án nằm trong 4 phương án, có giọng đọc', () => {
    const chapter = getChapter('number-finding')!;
    const qs = chapter.generator.generate({ rng: Math.random, count: 10, range: chapter.range, optionCount: 4 });
    expect(new Set(qs.map((q) => q.payload.number)).size).toBe(10);
    for (const q of qs) {
      expect(q.correctAnswer).toBe(q.payload.number);
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o === q.correctAnswer)).toHaveLength(1);
      expect(q.prompt).toMatch(/^Đâu là số .+\?$/);
      expect(existsSync(join(PUBLIC, `assets/sounds/questions/find-${q.payload.number}.m4a`))).toBe(true);
    }
    expect(qs.find((q) => q.payload.number === 5)!.prompt).toBe('Đâu là số năm?');
  });
});

describe('Chương 1 – Làm quen mặt số', () => {
  it('có đủ 100 thẻ số 1–100, có hình minh họa và âm thanh', () => {
    expect(NUMBER_CARDS.map((c) => c.value)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
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
