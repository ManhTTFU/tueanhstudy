/**
 * Chương "Cộng trừ": các trò chơi phép tính, chia cấp theo phạm vi.
 * Mỗi (cấp × phép tính) là một chương con (điểm, lịch sử, phần thưởng riêng);
 * cấp sau mở khi bé đạt >= 8/10 ở mọi trò của cấp trước (src/chapters/levels.ts).
 *
 * Mở rộng:
 *  - Thêm cấp (vd. phạm vi 20, 100): thêm 1 dòng vào ARITHMETIC_LEVELS + sticker cho từng trò.
 *  - Thêm phép tính (nhân, chia): thêm vào OPERATIONS (operations.ts) và ARITHMETIC_GAMES.
 */
import { REWARD_CONFIG } from '../../config/rewards.js';
import type { ChapterDefinition } from '../../engine/types.js';
import { ARITHMETIC_TYPE, createArithmeticGenerator, type ArithmeticPayload } from './generator.js';
import { OPERATIONS, type ArithmeticLevel, type OperationId } from './operations.js';

export const ARITHMETIC_ROOT_ID = 'arithmetic';

export const ARITHMETIC_LEVELS: ArithmeticLevel[] = [
  { level: 1, label: 'Phạm vi 5', max: 5, focusFrom: 0 },
  { level: 2, label: 'Phạm vi 10', max: 10, focusFrom: 5 },
];

/** Các trò chơi; `stickers[i]` = sticker lần đầu 10/10 ở cấp thứ i. */
export const ARITHMETIC_GAMES: { op: OperationId; stickers: string[] }[] = [
  { op: 'add', stickers: ['abacus', 'kite'] },
  { op: 'sub', stickers: ['teddy-bear', 'puzzle-piece'] },
];

const THEME = { primary: '#FF922B', soft: '#FFF0DB', strong: '#D9480F' };

/** Phép tính của từng chương con (dùng cho giao diện). */
export const ARITHMETIC_OP_OF = new Map<string, OperationId>();

export const arithmeticChapters: ChapterDefinition<ArithmeticPayload>[] = ARITHMETIC_LEVELS.flatMap((level, li) =>
  ARITHMETIC_GAMES.map(({ op, stickers }, gi) => {
    const operation = OPERATIONS[op];
    const isRoot = li === 0 && gi === 0;
    const example = operation.pairs(level)[0]!;
    const id = isRoot ? ARITHMETIC_ROOT_ID : `arithmetic-${op}-${level.max}`;
    ARITHMETIC_OP_OF.set(id, op);
    return {
      // Trò đầu tiên là chương gốc (hiện ở trang chủ), các trò còn lại là chương con.
      id,
      name: isRoot ? 'Cộng trừ' : `${operation.gameName} ${level.label.toLowerCase()}`,
      fullName: `${operation.gameName} ${level.label.toLowerCase()}`,
      description: isRoot ? 'Bé tập cộng, trừ trong phạm vi 10 bằng hình.' : `${operation.gameName} ${level.label.toLowerCase()}.`,
      icon: op === 'add' ? 'plus' : 'minus',
      theme: THEME,
      order: isRoot ? 4 : 100 + li * 10 + gi,
      enabled: true,
      ...(isRoot ? {} : { parentId: ARITHMETIC_ROOT_ID }),
      level: level.level,
      levelLabel: level.label,
      game: { name: operation.gameName, hint: `${example[0]} ${operation.symbol} ${example[1]} = ?` },
      range: operation.answerRange(level),
      questionType: ARITHMETIC_TYPE,
      quiz: { questionCount: 10, optionCount: 4, minDurationMs: 5_000 },
      hasLearningStage: false,
      rewards: { candiesForPerfect: REWARD_CONFIG.defaultCandiesForPerfect, firstPerfectSticker: stickers[li]! },
      generator: createArithmeticGenerator(op, level),
    } satisfies ChapterDefinition<ArithmeticPayload>;
  }),
);
