/**
 * Hệ thống đăng ký chương học (phần THUẦN – dùng chung client & server).
 * Thêm chương mới: tạo thư mục src/chapters/<id>/ với config.ts + generator.ts,
 * rồi thêm vào mảng CHAPTERS bên dưới (và đăng ký UI trong ui-registry.tsx).
 */
import type { ChapterDefinition } from '../engine/types.js';
import { numberRecognitionChapter } from './number-recognition/config.js';
import { objectCountingChapter } from './object-counting/config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyChapter = ChapterDefinition<any>;

export const CHAPTERS: readonly AnyChapter[] = [numberRecognitionChapter, objectCountingChapter];

export function getEnabledChapters(): AnyChapter[] {
  return CHAPTERS.filter((c) => c.enabled).sort((a, b) => a.order - b.order);
}

export function getChapter(id: string): AnyChapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}
