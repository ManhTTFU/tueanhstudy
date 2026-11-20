/**
 * Hệ thống đăng ký chương học (phần THUẦN – dùng chung client & server).
 * Thêm chương mới: tạo thư mục src/chapters/<id>/ với config.ts + generator.ts,
 * rồi thêm vào mảng CHAPTERS bên dưới (và đăng ký UI trong ui-registry.tsx).
 */
import type { AgeGroup, ChapterDefinition } from '../engine/types.js';
import { numberRecognitionChapter } from './number-recognition/config.js';
import { numberLevelChapters } from './number-recognition/levels.js';
import { numberFindingChapter } from './number-finding/config.js';
import { arithmeticChapters } from './arithmetic/config.js';
import { brainChapters } from './brain/config.js';
import { dadaChapters } from './dada/config.js';
import { objectCountingChapter } from './object-counting/config.js';
import { primaryChapters } from './primary/config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyChapter = ChapterDefinition<any>;

export const CHAPTERS: readonly AnyChapter[] = [
  numberRecognitionChapter,
  objectCountingChapter,
  numberFindingChapter,
  ...numberLevelChapters,
  ...arithmeticChapters,
  ...brainChapters,
  ...dadaChapters,
  ...primaryChapters,
];

export function getEnabledChapters(): AnyChapter[] {
  return CHAPTERS.filter((c) => c.enabled).sort((a, b) => a.order - b.order);
}

export function chapterAgeGroup(chapter: AnyChapter): AgeGroup {
  return chapter.ageGroup ?? 'preschool';
}

/**
 * Các chương hiện ở trang chủ của một nhóm tuổi
 * (không gồm trò chơi phụ và chương nằm trong chương khác).
 */
export function getHomeChapters(ageGroup: AgeGroup = 'preschool'): AnyChapter[] {
  return getEnabledChapters().filter((c) => !c.parentId && !c.hubId && !c.review && chapterAgeGroup(c) === ageGroup);
}

/** Các chương nằm trong trang của chương `hubId` (vd. chủ đề tư duy trong "Sân chơi trí tuệ"). */
export function getHubChapters(hubId: string): AnyChapter[] {
  return getEnabledChapters().filter((c) => c.hubId === hubId);
}

/** Các trò chơi phụ thuộc một chương (hiện trong trang của chương đó). */
export function getSubGames(parentId: string): AnyChapter[] {
  return getEnabledChapters().filter((c) => c.parentId === parentId);
}

export function getChapter(id: string): AnyChapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}
