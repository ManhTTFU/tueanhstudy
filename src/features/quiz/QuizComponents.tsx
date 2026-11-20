import { AnimatePresence, motion } from 'framer-motion';
import { Check, Delete } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Mascot } from '../../components/Mascot';
import { NumberWithDots } from '../../components/NumberDots';
import { TRY_AGAIN_MESSAGE } from '../../engine/messages';
import type { QuizPhase } from '../../engine/QuizSession';
import type { AnswerValue } from '../../engine/types';

const OPTION_COLORS = [
  { bg: '#FFE3EE', border: '#FF7BAC', text: '#C2255C' },
  { bg: '#DDF3FF', border: '#5BBCFF', text: '#1864AB' },
  { bg: '#FFF4CC', border: '#FFD23F', text: '#A35F00' },
  { bg: '#EEE5FF', border: '#A07BFF', text: '#5F3DC4' },
];

interface AnswerOptionsProps {
  options: AnswerValue[];
  correctAnswer: AnswerValue;
  triedWrong: AnswerValue[];
  phase: QuizPhase;
  lastSelected: AnswerValue | null;
  onAnswer: (v: AnswerValue) => void;
  /** Nội dung riêng của phương án (vd. hình). Mặc định hiện con số. */
  renderOption?: ((value: AnswerValue) => ReactNode) | undefined;
  /** Nhãn đọc cho trình đọc màn hình. Mặc định "Số <value>". */
  optionLabel?: ((value: AnswerValue) => string) | undefined;
}

/** 4 nút đáp án lớn (dùng chung cho mọi chương; mặc định đáp án là số). */
export function AnswerOptions({ options, correctAnswer, triedWrong, phase, lastSelected, onAnswer, renderOption, optionLabel }: AnswerOptionsProps) {
  const locked = phase !== 'answering';
  return (
    <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" role="group" aria-label="Các đáp án">
      {options.map((value, i) => {
        const c = OPTION_COLORS[i % OPTION_COLORS.length]!;
        const isTriedWrong = triedWrong.includes(value);
        const isCorrectShown = phase === 'correct' && value === correctAnswer;
        const isWrongNow = phase === 'wrong' && value === lastSelected;
        return (
          <motion.button
            key={`${value}`}
            type="button"
            data-testid="answer-option"
            data-value={value}
            disabled={locked || isTriedWrong}
            onClick={() => onAnswer(value)}
            aria-label={optionLabel ? optionLabel(value) : `Số ${value}`}
            initial={{ opacity: 0, y: 20 }}
            animate={
              isWrongNow
                ? { x: [0, -10, 10, -6, 6, 0], opacity: 1, y: 0 }
                : isCorrectShown
                  ? { scale: [1, 1.15, 1.05], opacity: 1, y: 0 }
                  : { opacity: isTriedWrong ? 0.35 : 1, y: 0, scale: 1 }
            }
            transition={{ duration: 0.45, delay: phase === 'answering' && !isTriedWrong ? i * 0.05 : 0 }}
            whileTap={locked ? undefined : { scale: 0.92 }}
            className="relative flex aspect-[4/3] min-h-[88px] items-center justify-center rounded-4xl border-[6px] text-6xl font-extrabold shadow-pop sm:text-7xl"
            style={{
              backgroundColor: isCorrectShown ? '#DDF8EC' : c.bg,
              borderColor: isCorrectShown ? '#22B573' : c.border,
              color: isCorrectShown ? '#087F5B' : c.text,
            }}
          >
            {renderOption ? renderOption(value) : <NumberWithDots value={value} />}
            {isCorrectShown && (
              <span className="absolute -right-3 -top-3 flex h-12 w-12 items-center justify-center rounded-full bg-mint-500 text-white shadow-pop-sm">
                <Check size={30} strokeWidth={4} />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Phản hồi đúng/sai: luôn nhẹ nhàng, tích cực. */
export function FeedbackBubble({ phase, praise, tryAgain = TRY_AGAIN_MESSAGE }: { phase: QuizPhase; praise: string; tryAgain?: string }) {
  const show = phase === 'correct' || phase === 'wrong';
  const correct = phase === 'correct';
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4"
          role="status"
          aria-live="polite"
          data-testid={correct ? 'feedback-correct' : 'feedback-wrong'}
        >
          <div
            className={`flex items-center gap-3 rounded-4xl px-5 py-3 shadow-soft sm:gap-4 sm:px-8 ${
              correct ? 'bg-mint-100 text-mint-500' : 'bg-sky-100 text-sky-500'
            }`}
            style={{ border: `5px solid ${correct ? '#4FD08F' : '#8FD3FF'}` }}
          >
            <Mascot mood={correct ? 'cheer' : 'sad'} size={84} />
            <span className={`text-2xl font-extrabold sm:text-4xl ${correct ? 'text-[#087F5B]' : 'text-[#1864AB]'}`}>
              {correct ? praise : tryAgain}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const MAX_INPUT_DIGITS = 5;

interface NumberPadProps {
  phase: QuizPhase;
  correctAnswer: AnswerValue;
  triedWrong: AnswerValue[];
  onSubmit: (v: AnswerValue) => void;
}

/** Bàn phím số cho câu tự gõ đáp án (dùng chung; nhận cả bàn phím máy tính). */
export function NumberPad({ phase, correctAnswer, triedWrong, onSubmit }: NumberPadProps) {
  const [buf, setBuf] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const locked = phase !== 'answering';

  // Sai => xoá số vừa nhập để bé gõ lại.
  useEffect(() => {
    if (phase === 'wrong') setBuf('');
  }, [phase]);

  const press = useCallback(
    (k: string) => {
      if (locked) return;
      setNote(null);
      if (k === 'del') return setBuf((b) => b.slice(0, -1));
      if (k === 'ok') {
        if (!buf) return;
        const v = Number(buf);
        if (triedWrong.includes(v)) {
          setNote('Con đã thử số này rồi, thử số khác nhé!');
          setBuf('');
          return;
        }
        onSubmit(v);
        return;
      }
      setBuf((b) => (b.length >= MAX_INPUT_DIGITS ? b : (b === '0' ? '' : b) + k));
    },
    [buf, locked, onSubmit, triedWrong],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') press('ok');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const shown = phase === 'correct' ? String(correctAnswer) : buf;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3" data-testid="number-pad">
      <motion.div
        key={phase === 'wrong' ? 'wrong' : 'input'}
        animate={phase === 'wrong' ? { x: [0, -10, 10, -6, 6, 0] } : phase === 'correct' ? { scale: [1, 1.12, 1] } : {}}
        transition={{ duration: 0.45 }}
        className={`flex h-20 w-full items-center justify-center rounded-3xl border-[5px] text-5xl font-extrabold tabular-nums ${
          phase === 'correct' ? 'border-mint-400 bg-mint-100 text-mint-500' : 'border-grape-300 bg-white text-ink'
        }`}
        data-testid="pad-display"
        aria-live="polite"
      >
        {shown || <span className="text-ink/25">?</span>}
        {phase === 'correct' && <Check size={40} strokeWidth={4} className="ml-2" />}
      </motion.div>
      {note && <p className="text-lg font-bold text-sky-500">{note}</p>}
      <div className="grid w-full grid-cols-3 gap-2" role="group" aria-label="Bàn phím số">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={locked || (k === 'ok' && !buf)}
            onClick={() => press(k)}
            data-testid={`pad-${k}`}
            aria-label={k === 'del' ? 'Xoá' : k === 'ok' ? 'Trả lời' : `Số ${k}`}
            className={`flex h-16 items-center justify-center rounded-2xl text-3xl font-extrabold shadow-pop-sm active:translate-y-0.5 disabled:opacity-40 ${
              k === 'ok' ? 'bg-mint-400 text-white' : k === 'del' ? 'bg-peach-100 text-peach-500' : 'bg-white text-ink'
            }`}
          >
            {k === 'del' ? <Delete size={30} /> : k === 'ok' ? <Check size={34} strokeWidth={4} /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
