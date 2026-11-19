import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import type { Question } from '../../../engine/types';
import { AudioController } from '../../../features/audio/AudioController';
import { findNumberVoice } from '../../../data/voice';
import type { NumberFindingPayload } from '../generator';

/** Hình minh họa: kính lúp lướt qua các con số. */
export function FindingIllustration() {
  return (
    <div className="relative flex h-full items-center justify-center gap-2" aria-hidden>
      {[3, 7, 5].map((d) => (
        <span key={d} className="font-extrabold leading-none text-grape-400/70" style={{ fontSize: 'clamp(2.5rem, 7vw, 4rem)' }}>
          {d}
        </span>
      ))}
      <motion.span
        className="absolute flex h-24 w-24 items-center justify-center rounded-full text-[#6741D9]"
        animate={{ x: [-60, 60, -60] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Search size={84} strokeWidth={2.6} />
      </motion.span>
    </div>
  );
}

/**
 * Câu hỏi "Đâu là số ...?": KHÔNG hiện chữ số cần tìm, chỉ có nút loa lớn
 * để bé nghe lại. Bé tìm chữ số trong các phương án bên dưới.
 */
export function FindingQuestionView({ question }: { question: Question<NumberFindingPayload> }) {
  return (
    <div className="flex items-center justify-center py-2">
      <motion.button
        type="button"
        key={question.id}
        onClick={() => void AudioController.speak(findNumberVoice(question.payload.number))}
        aria-label="Nghe lại câu hỏi"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
        className="flex aspect-square items-center justify-center rounded-full bg-white shadow-soft active:scale-95"
        style={{ width: 'clamp(9rem, 30vmin, 14rem)', border: '10px solid #9775FA33' }}
        data-testid="finding-display"
      >
        <motion.span
          className="text-[#6741D9]"
          animate={{ rotate: [-10, 10, -10] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Search size={96} strokeWidth={2.6} />
        </motion.span>
      </motion.button>
    </div>
  );
}
