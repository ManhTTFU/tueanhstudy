/**
 * Cấp độ & luật mở khoá (phần THUẦN – client hiển thị khoá, server chặn thật).
 *
 * Luật: cấp N (N > 1) mở khi MỌI trò của cấp N-1 trong cùng nhóm đều đã đạt
 * điểm cao nhất >= LEVEL_UNLOCK_MIN_SCORE (chỉ cần đạt 1 lần). Cấp 1 luôn mở.
 */
import { getChapter, getEnabledChapters, type AnyChapter } from './registry.js';

export const LEVEL_UNLOCK_MIN_SCORE = 8;

export interface ChapterLevel {
  level: number;
  /** Ví dụ "1–10". */
  label: string;
  /** Các trò trong cấp, theo thứ tự `order` (Nhìn số trước Tìm số). */
  games: AnyChapter[];
}

export function chapterLevel(chapter: AnyChapter): number {
  return chapter.level ?? 1;
}

/** Id chương gốc của nhóm (chương hiện ở trang chủ). */
export function groupRootId(chapter: AnyChapter): string {
  return chapter.parentId ?? chapter.id;
}

/** Các cấp của một nhóm chương, sắp theo cấp tăng dần. */
export function getLevels(rootId: string): ChapterLevel[] {
  const members = getEnabledChapters().filter((c) => groupRootId(c) === rootId);
  const byLevel = new Map<number, AnyChapter[]>();
  for (const c of members) {
    const list = byLevel.get(chapterLevel(c)) ?? [];
    list.push(c);
    byLevel.set(chapterLevel(c), list);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, games]) => {
      const sorted = games.sort((a, b) => a.order - b.order);
      const first = sorted[0]!;
      return { level, label: first.levelLabel ?? `${first.range.min}–${first.range.max}`, games: sorted };
    });
}

/** Các trò cần đạt điểm để mở chương này ([] nếu chương luôn mở). */
export function unlockRequirements(chapter: AnyChapter): AnyChapter[] {
  const level = chapterLevel(chapter);
  if (level <= 1) return [];
  const prev = getLevels(groupRootId(chapter)).filter((l) => l.level < level).pop();
  return prev?.games ?? [];
}

/** bestScoreOf(chapterId) trả điểm cao nhất bé từng đạt (0 nếu chưa chơi). */
export function isChapterUnlocked(chapter: AnyChapter, bestScoreOf: (chapterId: string) => number): boolean {
  return unlockRequirements(chapter).every((c) => bestScoreOf(c.id) >= LEVEL_UNLOCK_MIN_SCORE);
}

export function isChapterIdUnlocked(chapterId: string, bestScoreOf: (chapterId: string) => number): boolean {
  const chapter = getChapter(chapterId);
  return chapter ? isChapterUnlocked(chapter, bestScoreOf) : false;
}
