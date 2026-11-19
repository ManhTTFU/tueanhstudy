import { REWARD_CONFIG } from '../../config/rewards.js';
import type { ChapterDefinition } from '../../engine/types.js';
import { numberFindingGenerator, NUMBER_FINDING_TYPE, type NumberFindingPayload } from './generator.js';

/** Trò chơi phụ của "Làm quen mặt số": nghe tên số và chọn đúng chữ số. */
export const numberFindingChapter: ChapterDefinition<NumberFindingPayload> = {
  id: 'number-finding',
  name: 'Tìm số',
  description: 'Bé nghe câu hỏi rồi tìm đúng con số.',
  icon: 'search',
  theme: { primary: '#9775FA', soft: '#EFE9FF', strong: '#6741D9' },
  order: 3,
  enabled: true,
  parentId: 'number-recognition',
  game: { name: 'Tìm số', hint: 'Đâu là số năm?' },
  range: { min: 1, max: 10 },
  questionType: NUMBER_FINDING_TYPE,
  quiz: { questionCount: 10, optionCount: 4, minDurationMs: 5_000 },
  hasLearningStage: false,
  rewards: {
    candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect,
    firstPerfectSticker: 'magnifier',
  },
  generator: numberFindingGenerator,
};
