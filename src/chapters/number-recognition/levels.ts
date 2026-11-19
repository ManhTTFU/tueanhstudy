/**
 * Các cấp tiếp theo của "Làm quen mặt số" (cấp 1–10 là 2 chương gốc
 * number-recognition và number-finding). Mỗi cấp gồm 2 trò "Nhìn số" và
 * "Tìm số", là chương phụ (parentId) với điểm, lịch sử, phần thưởng riêng.
 *
 * Thêm cấp mới (ví dụ 101–110): tăng MAX_NUMBER trong src/data/numbers/numbers.ts
 * (và cách đọc số trong numberWord), thêm 1 cặp sticker vào LEVEL_STICKERS
 * + src/data/stickers.ts, rồi chạy assets:images + assets:voice.
 */
import { REWARD_CONFIG } from '../../config/rewards.js';
import { findNumberPrompt } from '../../data/numbers/numbers.js';
import type { ChapterDefinition } from '../../engine/types.js';
import { numberFindingGenerator, NUMBER_FINDING_TYPE, type NumberFindingPayload } from '../number-finding/generator.js';
import { numberRecognitionGenerator, NUMBER_RECOGNITION_TYPE, type NumberRecognitionPayload } from './generator.js';

interface NumberLevel {
  level: number;
  min: number;
  max: number;
  /** Sticker khi đạt 10/10 lần đầu ở trò "Nhìn số" / "Tìm số" của cấp. */
  recognitionSticker: string;
  findingSticker: string;
}

/** Cấp 2..10: 11–20, 21–30, ..., 91–100 (cấp 1 là 2 chương gốc 1–10). */
const LEVEL_STICKERS: [string, string][] = [
  ['sports-medal', 'owl'],
  ['lion', 'fox'],
  ['panda', 'koala'],
  ['penguin', 'turtle'],
  ['elephant', 'giraffe'],
  ['zebra', 'hedgehog'],
  ['peacock', 'parrot'],
  ['flamingo', 'sauropod'],
  ['t-rex', 'military-medal'],
];

const NUMBER_LEVELS: NumberLevel[] = LEVEL_STICKERS.map(([recognitionSticker, findingSticker], i) => ({
  level: i + 2,
  min: (i + 1) * 10 + 1,
  max: (i + 2) * 10,
  recognitionSticker,
  findingSticker,
}));

export const numberLevelChapters: ChapterDefinition<NumberRecognitionPayload | NumberFindingPayload>[] = NUMBER_LEVELS.flatMap(
  (lv) => {
    const label = `${lv.min}–${lv.max}`;
    const range = { min: lv.min, max: lv.max };
    const quiz = { questionCount: lv.max - lv.min + 1, optionCount: 4, minDurationMs: 5_000 };
    const recognition: ChapterDefinition<NumberRecognitionPayload> = {
      id: `number-recognition-${lv.min}-${lv.max}`,
      name: `Nhìn số ${label}`,
      description: `Bé nhận biết các con số từ ${lv.min} đến ${lv.max}.`,
      icon: 'hash',
      theme: { primary: '#FF7BAC', soft: '#FFE3EE', strong: '#C2255C' },
      order: 10 + lv.level * 2,
      enabled: true,
      parentId: 'number-recognition',
      level: lv.level,
      game: { name: 'Nhìn số', hint: 'Đây là số mấy?' },
      range,
      questionType: NUMBER_RECOGNITION_TYPE,
      quiz,
      hasLearningStage: true,
      rewards: { candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect, firstPerfectSticker: lv.recognitionSticker },
      generator: numberRecognitionGenerator,
    };
    const finding: ChapterDefinition<NumberFindingPayload> = {
      id: `number-finding-${lv.min}-${lv.max}`,
      name: `Tìm số ${label}`,
      description: `Bé nghe và tìm các con số từ ${lv.min} đến ${lv.max}.`,
      icon: 'search',
      theme: { primary: '#9775FA', soft: '#EFE9FF', strong: '#6741D9' },
      order: 11 + lv.level * 2,
      enabled: true,
      parentId: 'number-recognition',
      level: lv.level,
      game: { name: 'Tìm số', hint: findNumberPrompt(lv.min + 4) },
      range,
      questionType: NUMBER_FINDING_TYPE,
      quiz,
      hasLearningStage: false,
      rewards: { candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect, firstPerfectSticker: lv.findingSticker },
      generator: numberFindingGenerator,
    };
    return [recognition, finding];
  },
);
