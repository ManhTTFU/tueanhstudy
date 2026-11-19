/** Dữ liệu thẻ số 1–10 cho chương "Làm quen mặt số". */
export interface NumberCard {
  value: number;
  word: string;
  /** Hình minh họa: id trong thư viện hình (src/data/objects/catalog.ts). */
  objectId: string;
  /** Câu đọc minh họa, ví dụ "Một quả táo". */
  caption: string;
  color: string;
}

export const NUMBER_WORDS: Record<number, string> = {
  0: 'Không',
  1: 'Một',
  2: 'Hai',
  3: 'Ba',
  4: 'Bốn',
  5: 'Năm',
  6: 'Sáu',
  7: 'Bảy',
  8: 'Tám',
  9: 'Chín',
  10: 'Mười',
};

export const NUMBER_CARDS: readonly NumberCard[] = [
  { value: 1, word: 'Một', objectId: 'apple', caption: 'Một quả táo', color: '#FF6B6B' },
  { value: 2, word: 'Hai', objectId: 'duck', caption: 'Hai chú vịt', color: '#FF9E40' },
  { value: 3, word: 'Ba', objectId: 'tulip', caption: 'Ba bông hoa tulip', color: '#F7B500' },
  { value: 4, word: 'Bốn', objectId: 'rabbit', caption: 'Bốn chú thỏ', color: '#22B573' },
  { value: 5, word: 'Năm', objectId: 'star', caption: 'Năm ngôi sao', color: '#2E9BF0' },
  { value: 6, word: 'Sáu', objectId: 'fish', caption: 'Sáu chú cá', color: '#7C55E6' },
  { value: 7, word: 'Bảy', objectId: 'strawberry', caption: 'Bảy quả dâu tây', color: '#F0548E' },
  { value: 8, word: 'Tám', objectId: 'balloon', caption: 'Tám quả bóng bay', color: '#E8590C' },
  { value: 9, word: 'Chín', objectId: 'butterfly', caption: 'Chín chú bướm', color: '#0CA678' },
  { value: 10, word: 'Mười', objectId: 'ladybug', caption: 'Mười chú bọ rùa', color: '#5C7CFA' },
];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function numberAudio(n: number): string {
  return `/assets/sounds/numbers/${n}.m4a`;
}
