/**
 * Danh sách câu thoại có file giọng đọc trong public/assets/sounds/.
 * File được tạo bởi `npm run assets:voice` (có thể thay bằng file thu âm thật,
 * chỉ cần giữ nguyên tên file).
 */
import { ARITHMETIC_GAMES, ARITHMETIC_LEVELS } from '../chapters/arithmetic/config.js';
import { arithmeticSpeech, arithmeticVoiceFile, OPERATIONS } from '../chapters/arithmetic/operations.js';
import { dadaChapters } from '../chapters/dada/config.js';
import { speechFile, speechOf, type DadaQuestion } from '../chapters/dada/kit.js';
import { createSeededRng } from '../engine/random.js';
import { OBJECTS } from './objects/catalog.js';
import { MAX_NUMBER, NUMBER_CARDS, findNumberPrompt, numberWord } from './numbers/numbers.js';
import { PRAISES, PERFECT_MESSAGE, TRY_AGAIN_MESSAGE } from '../engine/messages.js';

export interface VoiceLine {
  /** Đường dẫn tương đối trong public/assets/sounds (không có đuôi). */
  file: string;
  text: string;
}

export const VOICE_PHRASES = {
  welcome: { file: 'phrases/welcome', text: 'Chào bé! Mình cùng học toán nhé!' },
  tryAgain: { file: 'phrases/try-again', text: TRY_AGAIN_MESSAGE },
  perfect: { file: 'phrases/perfect', text: 'Hoan hô! Bé đã hoàn thành xuất sắc!' },
  questionNumber: { file: 'phrases/question-number', text: 'Đây là số mấy?' },
  candy: { file: 'phrases/candy', text: 'Bé được thêm kẹo rồi!' },
  sticker: { file: 'phrases/sticker', text: 'Bé nhận được sticker mới!' },
  giftReady: { file: 'phrases/gift-ready', text: 'Bé mở hộp quà nào!' },
  finishCards: { file: 'phrases/finish-cards', text: 'Bé đã học hết các thẻ số rồi! Mình cùng chơi nhé!' },
  resultGreat: { file: 'phrases/result-great', text: 'Bé giỏi lắm! Sắp được mười điểm rồi đó!' },
  resultGood: { file: 'phrases/result-good', text: 'Bé làm tốt lắm! Mình chơi thêm lần nữa nhé!' },
  resultTry: { file: 'phrases/result-try', text: 'Bé đã rất cố gắng! Cùng luyện tập thêm nhé!' },
  chapterNumberRecognition: { file: 'phrases/chapter-number-recognition', text: 'Làm quen mặt số' },
  chapterObjectCounting: { file: 'phrases/chapter-object-counting', text: 'Bé tập đếm' },
  levelLocked: { file: 'phrases/level-locked', text: 'Bé đạt tám điểm ở cả hai trò chơi của cấp trước để mở cấp này nhé!' },
  chapterArithmetic: { file: 'phrases/chapter-arithmetic', text: 'Cộng trừ. Bé cùng làm phép tính bằng hình nhé!' },
  chapterBrain: { file: 'phrases/chapter-brain', text: 'Sân chơi trí tuệ. Bé cùng chơi và rèn luyện nhé!' },
  brainObserve: { file: 'phrases/brain-observe', text: 'Hình nào giống hình mẫu?' },
  brainPattern: { file: 'phrases/brain-pattern', text: 'Hình tiếp theo là hình nào?' },
  brainOdd: { file: 'phrases/brain-odd', text: 'Hình nào khác loại?' },
  brainMemoryLook: { file: 'phrases/brain-memory-look', text: 'Bé nhìn kỹ và nhớ các hình này nhé!' },
  brainMemoryAsk: { file: 'phrases/brain-memory-ask', text: 'Hình nào bé vừa thấy?' },
  brainSilhouette: { file: 'phrases/brain-silhouette', text: 'Cái bóng này là của hình nào?' },
  chapterDada: { file: 'phrases/chapter-dada', text: 'Sân chơi tư duy. Bé chọn trò chơi nhé!' },
  chapterNumberFinding: { file: 'phrases/chapter-number-finding', text: 'Tìm số. Bé nghe và chọn đúng con số nhé!' },
} satisfies Record<string, VoiceLine>;

export type VoicePhraseKey = keyof typeof VOICE_PHRASES;

export function praiseVoice(index: number): VoiceLine {
  return { file: `praise/${index}`, text: PRAISES[index] ?? PRAISES[0] };
}

export function findNumberVoice(n: number): VoiceLine {
  return { file: `questions/find-${n}`, text: findNumberPrompt(n) };
}

/** Giọng đọc mọi phép tính của mọi cấp (không trùng file). */
function arithmeticVoiceLines(): VoiceLine[] {
  const lines = new Map<string, VoiceLine>();
  for (const level of ARITHMETIC_LEVELS) {
    for (const { op } of ARITHMETIC_GAMES) {
      for (const [a, b] of OPERATIONS[op].pairs(level)) {
        const file = arithmeticVoiceFile(op, a, b);
        lines.set(file, { file, text: arithmeticSpeech(op, a, b) });
      }
    }
  }
  return [...lines.values()];
}

/**
 * Giọng đọc của "Sân chơi tư duy": câu hỏi sinh ngẫu nhiên nên lấy mẫu rất nhiều
 * bài với hạt giống cố định (kết quả ổn định giữa các lần chạy).
 */
export const DADA_VOICE_SAMPLES = 400;
let dadaCache: VoiceLine[] | null = null;
export function dadaVoiceLines(): VoiceLine[] {
  if (dadaCache) return dadaCache;
  const lines = new Map<string, VoiceLine>();
  dadaChapters.forEach((chapter, ci) => {
    for (let seed = 1; seed <= DADA_VOICE_SAMPLES; seed++) {
      const qs = chapter.generator.generate({ rng: createSeededRng(ci * 100_000 + seed), count: 10, range: chapter.range, optionCount: 4 });
      for (const q of qs as DadaQuestion[]) {
        const text = speechOf(q);
        lines.set(text, { file: speechFile(text), text });
      }
    }
  });
  lines.set('intro', VOICE_PHRASES.chapterDada);
  dadaCache = [...lines.values()];
  return dadaCache;
}

export function allVoiceLines(): VoiceLine[] {
  return [
    ...Object.values(VOICE_PHRASES),
    ...PRAISES.map((text, i) => ({ file: `praise/${i}`, text })),
    ...Array.from({ length: MAX_NUMBER + 1 }, (_, n) => ({ file: `numbers/${n}`, text: numberWord(n) })),
    ...NUMBER_CARDS.map((c) => ({ file: `cards/${c.value}`, text: `Số ${c.word.toLowerCase()}. ${c.caption}.` })),
    ...NUMBER_CARDS.map((c) => findNumberVoice(c.value)),
    ...arithmeticVoiceLines(),
    ...dadaVoiceLines(),
    ...OBJECTS.map((x) => ({ file: `questions/count-${x.id}`, text: `Có bao nhiêu ${x.label}?` })),
  ];
}

export const PERFECT_TEXT = PERFECT_MESSAGE;
