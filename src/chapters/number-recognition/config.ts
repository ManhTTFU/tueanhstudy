import { REWARD_CONFIG } from '../../config/rewards.js';
import type { ChapterDefinition } from '../../engine/types.js';
import { numberRecognitionGenerator, NUMBER_RECOGNITION_TYPE, type NumberRecognitionPayload } from './generator.js';

export const numberRecognitionChapter: ChapterDefinition<NumberRecognitionPayload> = {
  id: 'number-recognition',
  name: 'Làm quen mặt số',
  description: 'Bé học nhận biết các con số từ 1 đến 10.',
  icon: 'hash',
  theme: { primary: '#FF7BAC', soft: '#FFE3EE', strong: '#C2255C' },
  order: 1,
  enabled: true,
  range: { min: 1, max: 10 },
  questionType: NUMBER_RECOGNITION_TYPE,
  quiz: { questionCount: 10, optionCount: 4, minDurationMs: 5_000 },
  hasLearningStage: true,
  rewards: {
    candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect,
    firstPerfectSticker: 'gold-medal',
  },
  generator: numberRecognitionGenerator,
};
