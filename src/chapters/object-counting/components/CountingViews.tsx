import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { CountingGrid } from '../../../components/CountingGrid';
import { getObject, objectImage } from '../../../data/objects/catalog';
import type { Question } from '../../../engine/types';
import type { ObjectCountingPayload } from '../generator';

const SHOWCASE = ['rabbit', 'sunflower', 'apple', 'pine-tree', 'car', 'duck'];

/** Hình minh họa cho thẻ chương: động vật, hoa, cây cối, đồ vật. */
export function CountingIllustration() {
  return (
    <div className="grid h-full grid-cols-3 place-items-center gap-1" aria-hidden>
      {SHOWCASE.map((id, i) => (
        <motion.img
          key={id}
          src={objectImage(id)}
          alt=""
          className="h-12 w-12 sm:h-16 sm:w-16"
          animate={{ y: [0, -6, 0], rotate: [0, i % 2 ? 6 : -6, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

/** Câu hỏi đếm: hiển thị đúng số lượng hình, bé chạm từng hình để đếm. */
export function CountingQuestionView({ question }: { question: Question<ObjectCountingPayload> }) {
  const { objectId, count, label } = question.payload;
  const [resetCounter, setResetCounter] = useState(0);
  const object = getObject(objectId);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="card w-full max-w-3xl p-3 sm:p-5">
        <CountingGrid
          count={count}
          image={objectImage(object?.id ?? objectId)}
          alt={label}
          resetKey={`${question.id}-${resetCounter}`}
        />
      </div>
      <button
        type="button"
        onClick={() => setResetCounter((c) => c + 1)}
        className="flex min-h-[48px] items-center gap-2 rounded-full bg-white/80 px-4 text-lg font-bold text-ink/70 shadow-pop-sm active:translate-y-0.5"
      >
        <RotateCcw size={22} strokeWidth={2.6} /> Đếm lại
      </button>
    </div>
  );
}
