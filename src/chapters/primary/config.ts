/**
 * Các chương của nhóm 5–9 tuổi (ageGroup 'primary'):
 *  - "Tính nhẩm" (`pm-mental`): 6 cấp nối tiếp nhau (MENTAL_STAGES), cấp sau là chương con.
 *  - "Tư duy toán" (`pm-think`, chỉ là cửa vào – hubOnly): 7 chủ đề (PRIMARY_TOPICS),
 *    mỗi chủ đề 3 cấp. Cấp 1 có `hubId: 'pm-think'`, cấp 2–3 là chương con của cấp 1.
 */
import type { ChapterDefinition } from '../../engine/types.js';
import { levelGen, PRIMARY_TYPE, type PrimaryPayload } from './kit.js';
import { MENTAL_STAGES } from './mental.js';
import { PRIMARY_TOPICS, TOPIC_LEVELS, type PrimaryTopic } from './topics.js';

export const MENTAL_ROOT_ID = 'pm-mental';
export const THINK_HUB_ID = 'pm-think';

const MENTAL_THEME = { primary: '#12B886', soft: '#DDF8EC', strong: '#087F5B' };
const THINK_THEME = { primary: '#4C6EF5', soft: '#E3E9FF', strong: '#364FC7' };

/** Nhóm 5–9 tuổi không dùng kẹo / sticker: thưởng bằng xu (xem rewards.ts) để đổi quà thật. */
const NO_CANDY = { candiesForPerfect: 0 };

const common = {
  ageGroup: 'primary',
  enabled: true,
  range: { min: 0, max: 999 },
  questionType: PRIMARY_TYPE,
  hasLearningStage: false,
} as const;

const mentalChapters: ChapterDefinition<PrimaryPayload>[] = MENTAL_STAGES.map((stage, i) => {
  const isRoot = i === 0;
  return {
    ...common,
    id: isRoot ? MENTAL_ROOT_ID : `${MENTAL_ROOT_ID}-${i + 1}`,
    name: 'Tính nhẩm',
    fullName: `Tính nhẩm – ${stage.name}`,
    description: 'Cộng trừ qua 10, nhẩm 2 và 3 chữ số – có gợi ý từng bước',
    icon: 'calculator',
    theme: MENTAL_THEME,
    order: isRoot ? 50 : 2000 + i,
    ...(isRoot ? {} : { parentId: MENTAL_ROOT_ID }),
    level: i + 1,
    levelLabel: `Cấp ${i + 1}`,
    game: { name: stage.name, hint: stage.hint },
    quiz: { questionCount: 10, optionCount: 4, minDurationMs: 5_000 },
    rewards: NO_CANDY,
    generator: levelGen([[stage.gen, 1]], 1),
  };
});

export const thinkRootId = (topic: PrimaryTopic) => `pm-${topic.id}`;
/** Chủ đề của từng chương (dùng cho giao diện). */
export const PRIMARY_TOPIC_OF = new Map<string, PrimaryTopic>();

const thinkHub: ChapterDefinition<PrimaryPayload> = {
  ...common,
  id: THINK_HUB_ID,
  name: 'Tư duy toán',
  description: '7 chủ đề bài toán có lời văn: hơn kém, tính ngược, quy luật, thời gian, suy luận…',
  icon: 'lightbulb',
  theme: THINK_THEME,
  order: 51,
  hubOnly: true,
  quiz: { questionCount: 8, optionCount: 4, minDurationMs: 5_000 },
  rewards: NO_CANDY,
  // Chương cửa vào không có bài (startSession từ chối); generator chỉ để đủ kiểu.
  generator: levelGen(PRIMARY_TOPICS[0]!.gens, 1),
};

const topicChapters: ChapterDefinition<PrimaryPayload>[] = PRIMARY_TOPICS.flatMap((topic, ti) =>
  TOPIC_LEVELS.map(({ level, label }, li) => {
    const id = li === 0 ? thinkRootId(topic) : `${thinkRootId(topic)}-${level}`;
    PRIMARY_TOPIC_OF.set(id, topic);
    return {
      ...common,
      id,
      name: li === 0 ? topic.name : `${topic.name} – cấp ${level}`,
      fullName: `${topic.name} – ${label}`,
      description: topic.description,
      icon: topic.icon,
      theme: topic.theme,
      order: li === 0 ? 60 + ti : 2100 + ti * 10 + li,
      ...(li === 0 ? { hubId: THINK_HUB_ID } : { parentId: thinkRootId(topic) }),
      level,
      levelLabel: `Cấp ${level}`,
      game: { name: label, hint: topic.name },
      quiz: { questionCount: 8, optionCount: 4, minDurationMs: 5_000 },
      rewards: NO_CANDY,
      generator: levelGen(topic.gens, level),
    } satisfies ChapterDefinition<PrimaryPayload>;
  }),
);

export const REVIEW_CHAPTER_ID = 'pm-review';

/** "Ôn câu sai": câu hỏi do server lấy từ danh sách câu sai; ngoại tuyến thì luyện Cộng qua 10. */
const reviewChapter: ChapterDefinition<PrimaryPayload> = {
  ...common,
  id: REVIEW_CHAPTER_ID,
  name: 'Ôn câu sai',
  description: 'Làm lại các câu đã sai để nhớ lâu',
  icon: 'rotate',
  theme: { primary: '#F76707', soft: '#FFE8D6', strong: '#C04A00' },
  order: 90,
  review: true,
  quiz: { questionCount: 10, optionCount: 4, minDurationMs: 3_000 },
  rewards: NO_CANDY,
  generator: levelGen([[MENTAL_STAGES[0]!.gen, 1]], 1),
};

export const primaryChapters: ChapterDefinition<PrimaryPayload>[] = [...mentalChapters, thinkHub, ...topicChapters, reviewChapter];
