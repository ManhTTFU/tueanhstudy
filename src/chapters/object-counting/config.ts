import { REWARD_CONFIG } from '../../config/rewards.js';
import type { ChapterDefinition } from '../../engine/types.js';
import { objectCountingGenerator, OBJECT_COUNTING_TYPE, type ObjectCountingPayload } from './generator.js';

export const objectCountingChapter: ChapterDefinition<ObjectCountingPayload> = {
  id: 'object-counting',
  name: 'Bé tập đếm',
  description: 'Bé tập đếm số lượng từ 1 đến 10.',
  icon: 'paw-print',
  theme: { primary: '#4FD08F', soft: '#DDF8EC', strong: '#087F5B' },
  order: 2,
  enabled: true,
  range: { min: 1, max: 10 },
  questionType: OBJECT_COUNTING_TYPE,
  quiz: { questionCount: 10, optionCount: 4, minDurationMs: 8_000 },
  hasLearningStage: false,
  rewards: {
    candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect,
    firstPerfectSticker: 'trophy',
  },
  generator: objectCountingGenerator,
};
