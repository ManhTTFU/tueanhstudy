import type { ChapterTheme } from '../../engine/types.js';
import type { LevelGen } from './kit.js';

/** Một chủ đề: nhiều cấp, mỗi cấp một dạng bài (cấp sau mở khi đạt >= 8/10 cấp trước). */
export interface Topic {
  id: string;
  name: string;
  /** Emoji biểu tượng trên thẻ chủ đề. */
  icon: string;
  description: string;
  theme: ChapterTheme;
  /** Sticker khi đạt 10/10 lần đầu ở cấp cuối. */
  sticker: string;
  levels: { label: string; gen: LevelGen }[];
}
