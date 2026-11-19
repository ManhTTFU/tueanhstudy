/** Dữ liệu thẻ số 1–100 cho chương "Làm quen mặt số" (10 cấp, mỗi cấp 10 số). */
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

const CARDS_1_TO_10: readonly NumberCard[] = [
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

/** Số lớn nhất của chương "Làm quen mặt số". */
export const MAX_NUMBER = 100;

/**
 * Thẻ 11–100 dạy theo "chục và đơn vị": mỗi chục là một khung 10 hình đầy,
 * cộng thêm vài hình lẻ. Ví dụ 13 = "Một chục và ba", 40 = "Bốn chục".
 * Hình minh hoạ và màu lặp lại theo chữ số hàng đơn vị của thẻ 1–10.
 */
const CARDS_11_UP: readonly NumberCard[] = Array.from({ length: MAX_NUMBER - 10 }, (_, i) => {
  const value = i + 11;
  const base = CARDS_1_TO_10[(value - 1) % 10]!;
  const tens = Math.floor(value / 10);
  const units = value % 10;
  const tensText = `${NUMBER_WORDS[tens]} chục`;
  let caption = units === 0 ? tensText : `${tensText} và ${NUMBER_WORDS[units]!.toLowerCase()}`;
  if (value === 100) caption = 'Mười chục là một trăm';
  return { value, word: numberWord(value), objectId: base.objectId, caption, color: base.color };
});

export const NUMBER_CARDS: readonly NumberCard[] = [...CARDS_1_TO_10, ...CARDS_11_UP];

export function numberCardsInRange(min: number, max: number): NumberCard[] {
  return NUMBER_CARDS.filter((c) => c.value >= min && c.value <= max);
}

/**
 * Cách đọc số tiếng Việt 0–100, viết hoa chữ đầu: 15 = "Mười lăm",
 * 21 = "Hai mươi mốt", 24 = "Hai mươi tư", 30 = "Ba mươi".
 */
export function numberWord(n: number): string {
  if (n === 100) return 'Một trăm';
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n <= 10) return NUMBER_WORDS[n]!;
  const tens = Math.floor(n / 10);
  const units = n % 10;
  const head = tens === 1 ? 'Mười' : `${NUMBER_WORDS[tens]} mươi`;
  if (units === 0) return head;
  let tail = NUMBER_WORDS[units]!.toLowerCase();
  if (units === 5) tail = 'lăm';
  else if (units === 1 && tens >= 2) tail = 'mốt';
  else if (units === 4 && tens >= 2) tail = 'tư';
  return `${head} ${tail}`;
}

/** Câu hỏi trò "Tìm số", ví dụ "Đâu là số năm?". */
export function findNumberPrompt(n: number): string {
  return `Đâu là số ${numberWord(n).toLowerCase()}?`;
}

export function numberAudio(n: number): string {
  return `/assets/sounds/numbers/${n}.m4a`;
}
