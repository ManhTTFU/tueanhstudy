/**
 * Chương "Sân chơi trí tuệ": 5 trò rèn luyện kỹ năng (lấy cảm hứng từ các bộ sách
 * rèn luyện tư duy cho trẻ 3–6 tuổi): Quan sát, Chú ý, Tư duy, Ghi nhớ, Tưởng tượng.
 * Thẻ "Sân chơi trí tuệ" trên trang chủ giờ chỉ là CỬA VÀO 11 chủ đề "Sân chơi tư duy"
 * (hubOnly). 5 trò kỹ năng cũ đã được thay bằng các chủ đề đó nên đang TẮT
 * (enabled: false) – giữ lại định nghĩa để lịch sử bài cũ vẫn hiện đúng tên.
 *
 * Thêm kỹ năng: viết bộ sinh trong generators.ts, hình minh hoạ trong
 * components/BrainViews.tsx, rồi thêm 1 dòng vào BRAIN_GAMES.
 * Thêm độ khó: thêm `level: 2` cho các trò mới (khoá cấp tự hoạt động).
 */
import { REWARD_CONFIG } from '../../config/rewards.js';
import type { ChapterDefinition, QuestionGenerator } from '../../engine/types.js';
import {
  attentionGenerator,
  BRAIN_TYPE,
  logicGenerator,
  memoryGenerator,
  observeGenerator,
  silhouetteGenerator,
  type BrainPayload,
} from './generators.js';

export const BRAIN_ROOT_ID = 'brain';

export type BrainSkill = 'observe' | 'attention' | 'logic' | 'memory' | 'imagine';

interface BrainGame {
  skill: BrainSkill;
  name: string;
  hint: string;
  sticker: string;
  generator: QuestionGenerator<BrainPayload>;
  /** Phạm vi đáp án (chỉ có nghĩa với trò trả lời bằng số). */
  range: { min: number; max: number };
}

const IMAGE_RANGE = { min: 0, max: 999 };

export const BRAIN_GAMES: BrainGame[] = [
  { skill: 'observe', name: 'Quan sát', hint: 'Tìm hình giống hình mẫu', sticker: 'telescope', generator: observeGenerator, range: IMAGE_RANGE },
  { skill: 'attention', name: 'Chú ý', hint: 'Đếm đúng hình lẫn trong nhiều hình', sticker: 'bullseye', generator: attentionGenerator, range: { min: 1, max: 8 } },
  { skill: 'logic', name: 'Tư duy', hint: 'Tìm quy luật, tìm hình khác loại', sticker: 'light-bulb', generator: logicGenerator, range: IMAGE_RANGE },
  { skill: 'memory', name: 'Ghi nhớ', hint: 'Nhớ hình rồi chọn hình vừa thấy', sticker: 'brain', generator: memoryGenerator, range: IMAGE_RANGE },
  { skill: 'imagine', name: 'Tưởng tượng', hint: 'Cái bóng là của hình nào?', sticker: 'artist-palette', generator: silhouetteGenerator, range: IMAGE_RANGE },
];

const THEME = { primary: '#20C997', soft: '#DDF8F1', strong: '#087F5B' };

/** Kỹ năng của từng chương (dùng cho giao diện). */
export const BRAIN_SKILL_OF = new Map<string, BrainSkill>();

export const brainChapters: ChapterDefinition<BrainPayload>[] = BRAIN_GAMES.map((game, i) => {
  const isRoot = i === 0;
  const id = isRoot ? BRAIN_ROOT_ID : `brain-${game.skill}`;
  BRAIN_SKILL_OF.set(id, game.skill);
  return {
    id,
    name: isRoot ? 'Sân chơi trí tuệ' : game.name,
    ...(isRoot ? { hubOnly: true } : {}),
    fullName: `Trí tuệ – ${game.name}`,
    description: isRoot ? '11 chủ đề tư duy: màu sắc, hình khối, so sánh, mê cung, chữ cái, thời gian…' : game.hint,
    icon: 'brain',
    theme: THEME,
    order: isRoot ? 5 : 200 + i,
    // Gốc vẫn bật để hiện thẻ trên trang chủ; các trò con đã tắt.
    enabled: isRoot,
    ...(isRoot ? {} : { parentId: BRAIN_ROOT_ID }),
    level: 1,
    levelLabel: 'Kỹ năng',
    game: { name: game.name, hint: game.hint },
    range: game.range,
    questionType: BRAIN_TYPE,
    quiz: { questionCount: 10, optionCount: 4, minDurationMs: 5_000 },
    hasLearningStage: false,
    rewards: { candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect, firstPerfectSticker: game.sticker },
    generator: game.generator,
  } satisfies ChapterDefinition<BrainPayload>;
});
