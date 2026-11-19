/**
 * Bộ sưu tập sticker. Ảnh lưu tại public/assets/rewards/stickers/<code>.svg
 * (nguồn: Microsoft Fluent Emoji – giấy phép MIT, xem public/assets/LICENSES.md).
 */
export interface StickerDefinition {
  code: string;
  name: string;
  /** achievement: nhận theo thành tích; gift: chỉ có trong hộp quà. */
  kind: 'achievement' | 'gift';
  /** Tên thư mục tài nguyên Fluent Emoji (dùng bởi scripts/download-images.ts). */
  source: string;
}

export const STICKERS: readonly StickerDefinition[] = [
  // Thành tích
  { code: 'glowing-star', name: 'Ngôi sao đầu tiên', kind: 'achievement', source: 'Glowing star' },
  { code: 'gold-medal', name: 'Huy chương Mặt Số', kind: 'achievement', source: '1st place medal' },
  { code: 'trophy', name: 'Cúp Bé Tập Đếm', kind: 'achievement', source: 'Trophy' },
  { code: 'rainbow', name: 'Cầu vồng chăm chỉ', kind: 'achievement', source: 'Rainbow' },
  { code: 'rocket', name: 'Tên lửa siêu tốc', kind: 'achievement', source: 'Rocket' },
  { code: 'crown', name: 'Vương miện nhỏ', kind: 'achievement', source: 'Crown' },
  { code: 'gem-stone', name: 'Viên ngọc quý', kind: 'achievement', source: 'Gem stone' },
  // Hộp quà
  { code: 'unicorn', name: 'Kỳ lân', kind: 'gift', source: 'Unicorn' },
  { code: 'ringed-planet', name: 'Hành tinh', kind: 'gift', source: 'Ringed planet' },
  { code: 'flying-saucer', name: 'Đĩa bay', kind: 'gift', source: 'Flying saucer' },
  { code: 'ice-cream', name: 'Kem ốc quế', kind: 'gift', source: 'Ice cream' },
  { code: 'birthday-cake', name: 'Bánh sinh nhật', kind: 'gift', source: 'Birthday cake' },
  { code: 'carousel-horse', name: 'Ngựa gỗ', kind: 'gift', source: 'Carousel horse' },
  { code: 'ferris-wheel', name: 'Vòng đu quay', kind: 'gift', source: 'Ferris wheel' },
  { code: 'hatching-chick', name: 'Gà con nở', kind: 'gift', source: 'Hatching chick' },
  { code: 'party-popper', name: 'Pháo giấy', kind: 'gift', source: 'Party popper' },
  { code: 'magic-wand', name: 'Đũa phép', kind: 'gift', source: 'Magic wand' },
  { code: 'shooting-star', name: 'Sao băng', kind: 'gift', source: 'Shooting star' },
  { code: 'shaved-ice', name: 'Đá bào', kind: 'gift', source: 'Shaved ice' },
  { code: 'bubble-tea', name: 'Trà sữa', kind: 'gift', source: 'Bubble tea' },
  { code: 'sparkling-heart', name: 'Trái tim lấp lánh', kind: 'gift', source: 'Sparkling heart' },
  { code: 'crystal-ball', name: 'Quả cầu pha lê', kind: 'gift', source: 'Crystal ball' },
  { code: 'bubbles', name: 'Bong bóng xà phòng', kind: 'gift', source: 'Bubbles' },
  { code: 'dolphin', name: 'Cá heo vui vẻ', kind: 'gift', source: 'Dolphin' },
  { code: 'sun-with-face', name: 'Ông mặt trời', kind: 'gift', source: 'Sun with face' },
] as const;

export const STICKER_CODES = STICKERS.map((s) => s.code);
export const GIFT_STICKER_CODES = STICKERS.filter((s) => s.kind === 'gift').map((s) => s.code);

export function getSticker(code: string): StickerDefinition | undefined {
  return STICKERS.find((s) => s.code === code);
}

export function stickerImage(code: string): string {
  return `/assets/rewards/stickers/${code}.svg`;
}
