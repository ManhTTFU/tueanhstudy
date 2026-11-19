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
  { code: 'abacus', name: 'Bàn tính cộng phạm vi 5', kind: 'achievement', source: 'Abacus' },
  { code: 'teddy-bear', name: 'Gấu bông trừ phạm vi 5', kind: 'achievement', source: 'Teddy bear' },
  { code: 'kite', name: 'Diều cộng phạm vi 10', kind: 'achievement', source: 'Kite' },
  { code: 'puzzle-piece', name: 'Mảnh ghép trừ phạm vi 10', kind: 'achievement', source: 'Puzzle piece' },
  { code: 'telescope', name: 'Kính viễn vọng Quan sát', kind: 'achievement', source: 'Telescope' },
  { code: 'bullseye', name: 'Hồng tâm Chú ý', kind: 'achievement', source: 'Bullseye' },
  { code: 'light-bulb', name: 'Bóng đèn Tư duy', kind: 'achievement', source: 'Light bulb' },
  { code: 'brain', name: 'Bộ não Ghi nhớ', kind: 'achievement', source: 'Brain' },
  { code: 'artist-palette', name: 'Bảng màu Tưởng tượng', kind: 'achievement', source: 'Artist palette' },
  { code: 'paintbrush', name: 'Cọ vẽ Màu sắc', kind: 'achievement', source: 'Paintbrush' },
  { code: 'triangular-ruler', name: 'Thước Hình khối', kind: 'achievement', source: 'Triangular ruler' },
  { code: 'hundred-points', name: 'Điểm 100 Đếm số', kind: 'achievement', source: 'Hundred points' },
  { code: 'input-numbers', name: 'Bảng số Toán vui', kind: 'achievement', source: 'Input numbers' },
  { code: 'balance-scale', name: 'Cân So sánh', kind: 'achievement', source: 'Balance scale' },
  { code: 'basket', name: 'Giỏ Phân loại', kind: 'achievement', source: 'Basket' },
  { code: 'eyes', name: 'Đôi mắt Quan sát', kind: 'achievement', source: 'Eyes' },
  { code: 'bricks', name: 'Gạch Quy luật', kind: 'achievement', source: 'Brick' },
  { code: 'compass', name: 'La bàn Mê cung', kind: 'achievement', source: 'Compass' },
  { code: 'pencil', name: 'Bút chì Chữ cái', kind: 'achievement', source: 'Pencil' },
  { code: 'alarm-clock', name: 'Đồng hồ Thời gian', kind: 'achievement', source: 'Alarm clock' },
  { code: 'magnifier', name: 'Kính lúp Tìm Số', kind: 'achievement', source: 'Magnifying glass tilted left' },
  { code: 'trophy', name: 'Cúp Bé Tập Đếm', kind: 'achievement', source: 'Trophy' },
  { code: 'rainbow', name: 'Cầu vồng chăm chỉ', kind: 'achievement', source: 'Rainbow' },
  { code: 'rocket', name: 'Tên lửa siêu tốc', kind: 'achievement', source: 'Rocket' },
  { code: 'crown', name: 'Vương miện nhỏ', kind: 'achievement', source: 'Crown' },
  { code: 'gem-stone', name: 'Viên ngọc quý', kind: 'achievement', source: 'Gem stone' },
  { code: 'sports-medal', name: 'Huy chương số 11–20', kind: 'achievement', source: 'Sports medal' },
  { code: 'owl', name: 'Cú thông thái 11–20', kind: 'achievement', source: 'Owl' },
  { code: 'lion', name: 'Sư tử 21–30', kind: 'achievement', source: 'Lion' },
  { code: 'fox', name: 'Cáo nhỏ 21–30', kind: 'achievement', source: 'Fox' },
  { code: 'panda', name: 'Gấu trúc 31–40', kind: 'achievement', source: 'Panda' },
  { code: 'koala', name: 'Gấu koala 31–40', kind: 'achievement', source: 'Koala' },
  { code: 'penguin', name: 'Chim cánh cụt 41–50', kind: 'achievement', source: 'Penguin' },
  { code: 'turtle', name: 'Rùa con 41–50', kind: 'achievement', source: 'Turtle' },
  { code: 'elephant', name: 'Voi con 51–60', kind: 'achievement', source: 'Elephant' },
  { code: 'giraffe', name: 'Hươu cao cổ 51–60', kind: 'achievement', source: 'Giraffe' },
  { code: 'zebra', name: 'Ngựa vằn 61–70', kind: 'achievement', source: 'Zebra' },
  { code: 'hedgehog', name: 'Nhím con 61–70', kind: 'achievement', source: 'Hedgehog' },
  { code: 'peacock', name: 'Chim công 71–80', kind: 'achievement', source: 'Peacock' },
  { code: 'parrot', name: 'Vẹt xanh 71–80', kind: 'achievement', source: 'Parrot' },
  { code: 'flamingo', name: 'Hồng hạc 81–90', kind: 'achievement', source: 'Flamingo' },
  { code: 'sauropod', name: 'Khủng long cổ dài 81–90', kind: 'achievement', source: 'Sauropod' },
  { code: 't-rex', name: 'Khủng long bạo chúa 91–100', kind: 'achievement', source: 'T-rex' },
  { code: 'military-medal', name: 'Huân chương số 100', kind: 'achievement', source: 'Military medal' },
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
