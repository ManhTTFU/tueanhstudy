/**
 * Bộ máy PHÉP TÍNH dùng chung (phần THUẦN – client & server).
 *
 * Mỗi phép tính là một mục trong OPERATIONS: ký hiệu, cách đọc, cách tính, và
 * cách liệt kê mọi cặp số (a, b) hợp lệ của một cấp. Bộ sinh câu hỏi, giọng đọc,
 * giao diện đều dựa vào đây.
 *
 * Thêm phép nhân/chia: thêm một mục vào OPERATIONS (vd. `mul`: pairs trả các
 * cặp a×b ≤ max), khai báo trò chơi trong config.ts, thêm hình minh hoạ trong
 * components/ArithmeticViews.tsx (OPERATION_VIEWS), rồi `npm run assets:voice`.
 * Cộng/trừ 2 chữ số: thêm cấp mới (max 20/100…) – pairs đã tổng quát theo `max`.
 */
import { numberWord } from '../../data/numbers/numbers.js';
import type { NumberRange } from '../../engine/types.js';

export type OperationId = 'add' | 'sub';

/** Một cấp độ: phạm vi kết quả. `focusFrom` > 0 => chỉ lấy phép tính có số lớn nhất > focusFrom. */
export interface ArithmeticLevel {
  level: number;
  /** Tên cấp hiển thị, ví dụ "Phạm vi 5". */
  label: string;
  max: number;
  focusFrom: number;
}

export interface ArithmeticOperation {
  id: OperationId;
  symbol: string;
  /** Cách đọc: "cộng", "trừ". */
  word: string;
  /** Tên trò chơi: "Phép cộng". */
  gameName: string;
  compute: (a: number, b: number) => number;
  /** Mọi cặp (a, b) hợp lệ của cấp – càng ít ràng buộc càng dễ mở rộng. */
  pairs: (level: ArithmeticLevel) => [number, number][];
  /** Phạm vi các phương án trả lời. */
  answerRange: (level: ArithmeticLevel) => NumberRange;
}

export const OPERATIONS: Record<OperationId, ArithmeticOperation> = {
  add: {
    id: 'add',
    symbol: '+',
    word: 'cộng',
    gameName: 'Phép cộng',
    compute: (a, b) => a + b,
    // a, b >= 1; tổng nằm trong (focusFrom, max]
    pairs: ({ max, focusFrom }) => {
      const out: [number, number][] = [];
      for (let a = 1; a < max; a++) for (let b = 1; a + b <= max; b++) if (a + b > focusFrom) out.push([a, b]);
      return out;
    },
    answerRange: ({ max }) => ({ min: 1, max }),
  },
  sub: {
    id: 'sub',
    symbol: '−',
    word: 'trừ',
    gameName: 'Phép trừ',
    compute: (a, b) => a - b,
    // Số bị trừ trong (focusFrom, max]; còn lại ít nhất 1 hình để bé đếm.
    pairs: ({ max, focusFrom }) => {
      const out: [number, number][] = [];
      for (let a = Math.max(2, focusFrom + 1); a <= max; a++) for (let b = 1; b < a; b++) out.push([a, b]);
      return out;
    },
    answerRange: ({ max }) => ({ min: 1, max }),
  },
};

/** Câu đọc: "Hai cộng ba bằng mấy?" */
export function arithmeticSpeech(op: OperationId, a: number, b: number): string {
  return `${numberWord(a)} ${OPERATIONS[op].word} ${numberWord(b).toLowerCase()} bằng mấy?`;
}

/** Tên file giọng đọc (không đuôi) trong public/assets/sounds. */
export function arithmeticVoiceFile(op: OperationId, a: number, b: number): string {
  return `questions/${op}-${a}-${b}`;
}
