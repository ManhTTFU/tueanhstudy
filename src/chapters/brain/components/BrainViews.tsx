/**
 * Giao diện "Sân chơi trí tuệ": mỗi kỹ năng một cách hiển thị câu hỏi;
 * phương án là hình (lấy từ payload.choices) hoặc con số (trò Chú ý).
 */
import { motion } from 'framer-motion';
import { Brain, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getObject, objectImage } from '../../../data/objects/catalog';
import { VOICE_PHRASES } from '../../../data/voice';
import type { Question } from '../../../engine/types';
import { AudioController } from '../../../features/audio/AudioController';
import { choiceObjectId, memoryShowMs, type BrainPayload } from '../generators';

type Q = Question<BrainPayload>;

function Img({ id, className = '', style }: { id: string; className?: string; style?: React.CSSProperties }) {
  return <img src={objectImage(id)} alt="" draggable={false} className={`object-contain ${className}`} style={style} />;
}

function Card({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="relative flex flex-col items-center rounded-4xl border-4 border-dashed border-ink/15 bg-white/90 px-6 pb-4 pt-5 shadow-soft">
      {label && <span className="absolute -top-4 rounded-full bg-mint-400 px-3 py-0.5 text-base font-bold text-white">{label}</span>}
      {children}
    </div>
  );
}

const pop = { initial: { scale: 0.4, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: 'spring' as const, stiffness: 240, damping: 16 } };

function ObserveView({ target }: { target: string }) {
  return (
    <motion.div {...pop}>
      <Card label="Hình mẫu">
        <Img id={target} className="h-28 w-28 sm:h-36 sm:w-36" />
      </Card>
    </motion.div>
  );
}

function SilhouetteView({ target }: { target: string }) {
  return (
    <motion.div {...pop}>
      <Card label="Cái bóng">
        {/* Tô đen toàn bộ hình => chỉ còn đường viền (bóng) */}
        <Img id={target} className="h-28 w-28 sm:h-36 sm:w-36" style={{ filter: 'brightness(0)', opacity: 0.85 }} />
      </Card>
    </motion.div>
  );
}

function AttentionView({ grid }: { grid: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-4xl bg-white/90 p-3 shadow-soft sm:gap-3" data-testid="attention-grid">
      {grid.map((id, i) => (
        <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.04 }}>
          <Img id={id} className="h-12 w-12 sm:h-16 sm:w-16" />
        </motion.div>
      ))}
    </div>
  );
}

function PatternView({ sequence }: { sequence: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-4xl bg-white/90 p-3 shadow-soft sm:gap-2">
      {sequence.map((id, i) => (
        <motion.div key={i} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.12 }}>
          <Img id={id} className="h-11 w-11 sm:h-16 sm:w-16" />
        </motion.div>
      ))}
      <motion.span
        className="flex h-11 w-11 items-center justify-center rounded-2xl border-4 border-dashed border-mint-400 text-mint-500 sm:h-16 sm:w-16"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        <HelpCircle className="h-7 w-7 sm:h-10 sm:w-10" strokeWidth={3} />
      </motion.span>
    </div>
  );
}

function OddView() {
  return (
    <p className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-lg font-bold text-ink/70 shadow-soft">
      <Brain size={22} className="text-mint-500" /> Ba hình cùng loại, một hình khác loại
    </p>
  );
}

/** Ghi nhớ: hiện các hình trong vài giây rồi úp lại, sau đó hỏi. */
function MemoryView({ shown }: { shown: string[] }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setHidden(true);
      void AudioController.speak(VOICE_PHRASES.brainMemoryAsk);
    }, memoryShowMs(shown.length));
    return () => window.clearTimeout(t);
  }, [shown.length]);
  return (
    <div className="flex gap-3 sm:gap-4" data-testid={hidden ? 'memory-hidden' : 'memory-shown'}>
      {shown.map((id, i) => (
        <motion.div
          key={i}
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-soft sm:h-32 sm:w-32"
          animate={{ rotateY: hidden ? 180 : 0, backgroundColor: hidden ? '#20C997' : '#FFFFFF' }}
          transition={{ duration: 0.5, delay: hidden ? i * 0.1 : 0 }}
        >
          {hidden ? (
            <HelpCircle className="h-12 w-12 text-white" strokeWidth={3} style={{ transform: 'scaleX(-1)' }} />
          ) : (
            <Img id={id} className="h-16 w-16 sm:h-24 sm:w-24" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function BrainQuestionView({ question }: { question: Q }) {
  const p = question.payload;
  return (
    <div className="flex w-full justify-center py-1" data-testid={`brain-${p.kind}`}>
      {p.kind === 'observe' && <ObserveView target={p.target} />}
      {p.kind === 'silhouette' && <SilhouetteView target={p.target} />}
      {p.kind === 'attention' && <AttentionView grid={p.grid} />}
      {p.kind === 'pattern' && <PatternView sequence={p.sequence} />}
      {p.kind === 'odd' && <OddView />}
      {p.kind === 'memory' && <MemoryView shown={p.shown} />}
    </div>
  );
}

/** Phương án: hình (trò chọn hình) hoặc con số (trò Chú ý). */
export function BrainOption({ value, question }: { value: number; question: Q }) {
  const id = choiceObjectId(question.payload, value);
  if (!id) return <>{value}</>;
  return <Img id={id} className="h-16 w-16 sm:h-24 sm:w-24" />;
}

export function brainOptionLabel(value: number, question: Q): string {
  const id = choiceObjectId(question.payload, value);
  return id ? (getObject(id)?.label ?? 'Hình') : `Số ${value}`;
}

export function brainImages(question: Q): string[] {
  const p = question.payload;
  const ids = new Set<string>('choices' in p ? Object.values(p.choices) : []);
  if (p.kind === 'observe' || p.kind === 'silhouette' || p.kind === 'attention') ids.add(p.target);
  if (p.kind === 'attention') p.grid.forEach((id) => ids.add(id));
  if (p.kind === 'pattern') p.sequence.forEach((id) => ids.add(id));
  if (p.kind === 'memory') p.shown.forEach((id) => ids.add(id));
  return [...ids].map(objectImage);
}

/** Hình minh hoạ trên thẻ chương. */
export function BrainIllustration() {
  const ids = ['owl', 'apple', 'butterfly', 'star', 'rabbit'];
  return (
    <div className="flex h-full items-center justify-center gap-2" aria-hidden>
      {ids.map((id, i) => (
        <motion.div key={id} animate={{ y: [0, -8, 0], rotate: [0, i % 2 ? 6 : -6, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}>
          <Img id={id} className="h-11 w-11 sm:h-14 sm:w-14" style={i === 2 ? { filter: 'brightness(0)', opacity: 0.8 } : undefined} />
        </motion.div>
      ))}
    </div>
  );
}
