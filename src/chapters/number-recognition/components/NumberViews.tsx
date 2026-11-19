import { motion } from 'framer-motion';
import { NUMBER_CARDS } from '../../../data/numbers/numbers';
import type { Question } from '../../../engine/types';
import type { NumberRecognitionPayload } from '../generator';

const DIGIT_COLORS = ['#FF6B6B', '#FF9E40', '#F7B500', '#22B573', '#2E9BF0', '#7C55E6', '#F0548E'];

/** Hình minh họa cho thẻ chương trên trang chủ: các con số nhiều màu sắc. */
export function NumberIllustration() {
  const digits = [1, 2, 3, 4, 5];
  return (
    <div className="flex h-full items-center justify-center gap-1 sm:gap-2" aria-hidden>
      {digits.map((d, i) => (
        <motion.span
          key={d}
          className="font-extrabold leading-none drop-shadow-[0_4px_0_rgba(59,47,92,0.15)]"
          style={{ color: DIGIT_COLORS[i], fontSize: 'clamp(2.75rem, 8vw, 4.5rem)', rotate: `${(i % 2 ? 1 : -1) * 8}deg` }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.18 }}
        >
          {d}
        </motion.span>
      ))}
    </div>
  );
}

export function numberColor(n: number): string {
  return NUMBER_CARDS.find((c) => c.value === n)?.color ?? DIGIT_COLORS[n % DIGIT_COLORS.length]!;
}

/** Câu hỏi nhận biết số: một chữ số thật lớn. */
export function NumberQuestionView({ question }: { question: Question<NumberRecognitionPayload> }) {
  const n = question.payload.number;
  const color = numberColor(n);
  return (
    <div className="flex items-center justify-center py-2">
      <motion.div
        key={question.id}
        initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
        className="flex aspect-square items-center justify-center rounded-full bg-white shadow-soft"
        style={{ width: 'clamp(11rem, 38vmin, 18rem)', border: `10px solid ${color}33` }}
        data-testid="number-display"
      >
        <span className="font-extrabold leading-none" style={{ color, fontSize: 'clamp(7rem, 26vmin, 12rem)' }}>
          {n}
        </span>
      </motion.div>
    </div>
  );
}
