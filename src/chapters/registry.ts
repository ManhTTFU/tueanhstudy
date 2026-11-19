/**
 * Hệ thống đăng ký chương học (phần THUẦN – dùng chung client & server).
 * Thêm chương mới: tạo thư mục src/chapters/<id>/ với config.ts + generator.ts,
 * rồi thêm vào mảng CHAPTERS bên dưới (và đăng ký UI trong ui-registry.tsx).
 */
import type { ChapterDefinition } from '../engine/types.js';
import { numberRecognitionChapter } from './number-recognition/config.js';
import { numberLevelChapters } from './number-recognition/levels.js';
import { numberFindingChapter } from './number-finding/config.js';
import { objectCountingChapter } from './object-counting/config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyChapter = ChapterDefinition<any>;

export const CHAPTERS: readonly AnyChapter[] = [
  numberRecognitionChapter,
  objectCountingChapter,
  numberFindingChapter,
  ...numberLevelChapters,
];

export function getEnabledChapters(): AnyChapter[] {
  return CHAPTERS.filter((c) => c.enabled).sort((a, b) => a.order - b.order);
}

/** Các chương hiện ở trang chủ (không gồm trò chơi phụ). */
export function getHomeChapters(): AnyChapter[] {
  return getEnabledChapters().filter((c) => !c.parentId);
}

/** Các trò chơi phụ thuộc một chương (hiện trong trang của chương đó). */
export function getSubGames(parentId: string): AnyChapter[] {
  return getEnabledChapters().filter((c) => c.parentId === parentId);
}

export function getChapter(id: string): AnyChapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}
