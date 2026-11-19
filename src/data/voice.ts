/**
 * Danh sách câu thoại có file giọng đọc trong public/assets/sounds/.
 * File được tạo bởi `npm run assets:voice` (có thể thay bằng file thu âm thật,
 * chỉ cần giữ nguyên tên file).
 */
import { OBJECTS } from './objects/catalog.js';
import { NUMBER_CARDS, numberWord } from './numbers/numbers.js';
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
} satisfies Record<string, VoiceLine>;

export type VoicePhraseKey = keyof typeof VOICE_PHRASES;

export function praiseVoice(index: number): VoiceLine {
  return { file: `praise/${index}`, text: PRAISES[index] ?? PRAISES[0] };
}

export function allVoiceLines(): VoiceLine[] {
  return [
    ...Object.values(VOICE_PHRASES),
    ...PRAISES.map((text, i) => ({ file: `praise/${i}`, text })),
    ...Array.from({ length: 11 }, (_, n) => ({ file: `numbers/${n}`, text: numberWord(n) })),
    ...NUMBER_CARDS.map((c) => ({ file: `cards/${c.value}`, text: `Số ${c.word.toLowerCase()}. ${c.caption}.` })),
    ...OBJECTS.map((x) => ({ file: `questions/count-${x.id}`, text: `Có bao nhiêu ${x.label}?` })),
  ];
}

export const PERFECT_TEXT = PERFECT_MESSAGE;
