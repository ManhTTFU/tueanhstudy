/**
 * "Sân chơi tư duy": 11 chủ đề, mỗi chủ đề nhiều cấp (mỗi cấp một dạng bài).
 * Chương gốc = cấp 1 của chủ đề (hiện ở trang chủ, mục "Sân chơi tư duy");
 * cấp sau là chương con, mở khi đạt >= 8/10 ở cấp trước.
 *
 * Thêm chủ đề: viết topics/<id>.ts (export một Topic) rồi thêm vào TOPICS.
 * Thêm cấp: thêm một dòng vào `levels` của chủ đề.
 */
import { REWARD_CONFIG } from '../../config/rewards.js';
import type { ChapterDefinition } from '../../engine/types.js';
import { DADA_TYPE, levelGenerator, type DadaPayload } from './kit.js';
import type { Topic } from './topic.js';
import { classifyTopic } from './topics/classify.js';
import { colorsTopic } from './topics/colors.js';
import { compareTopic } from './topics/compare.js';
import { countingTopic } from './topics/counting.js';
import { lettersTopic } from './topics/letters.js';
import { mathTopic } from './topics/math.js';
import { mazeTopic } from './topics/maze.js';
import { observeTopic } from './topics/observe.js';
import { patternsTopic } from './topics/patterns.js';
import { shapesTopic } from './topics/shapes.js';
import { timeTopic } from './topics/time.js';

export const TOPICS: Topic[] = [
  colorsTopic,
  shapesTopic,
  countingTopic,
  mathTopic,
  compareTopic,
  classifyTopic,
  observeTopic,
  patternsTopic,
  mazeTopic,
  lettersTopic,
  timeTopic,
];

export const dadaRootId = (topic: Topic) => `dd-${topic.id}`;
/** Chủ đề của từng chương (dùng cho giao diện). */
export const TOPIC_OF = new Map<string, Topic>();

export const dadaChapters: ChapterDefinition<DadaPayload>[] = TOPICS.flatMap((topic, ti) =>
  topic.levels.map((lv, li) => {
    const id = li === 0 ? dadaRootId(topic) : `${dadaRootId(topic)}-${li + 1}`;
    TOPIC_OF.set(id, topic);
    const last = li === topic.levels.length - 1;
    return {
      id,
      name: li === 0 ? topic.name : `${topic.name} – cấp ${li + 1}`,
      fullName: `${topic.name} – ${lv.label}`,
      description: topic.description,
      icon: topic.icon,
      theme: topic.theme,
      order: li === 0 ? 10 + ti : 1000 + ti * 20 + li,
      enabled: true,
      // Cấp 1 của chủ đề hiện trong trang "Sân chơi trí tuệ"; các cấp sau là chương con của nó.
      ...(li === 0 ? { hubId: 'brain' } : { parentId: dadaRootId(topic) }),
      level: li + 1,
      levelLabel: `Cấp ${li + 1}`,
      game: { name: lv.label, hint: topic.name },
      range: { min: 0, max: 30 },
      questionType: DADA_TYPE,
      quiz: { questionCount: 10, optionCount: 4, minDurationMs: 5_000 },
      hasLearningStage: false,
      rewards: {
        candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect,
        ...(last ? { firstPerfectSticker: topic.sticker } : {}),
      },
      generator: levelGenerator(lv.gen),
    } satisfies ChapterDefinition<DadaPayload>;
  }),
);
