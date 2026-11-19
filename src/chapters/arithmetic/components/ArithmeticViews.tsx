/**
 * Hình minh hoạ phép tính. Mỗi phép tính có một cách vẽ riêng trong OPERATION_VIEWS:
 *  - Cộng: hai nhóm hình, ở giữa là dấu "+" => bé đếm gộp.
 *  - Trừ: một nhóm hình, vài hình cuối bị gạch chéo và mờ đi => bé đếm phần còn lại.
 * Thêm phép nhân/chia: thêm một mục vào OPERATION_VIEWS (vd. nhân = b nhóm, mỗi nhóm a hình).
 */
import { motion } from 'framer-motion';
import { Minus, Plus, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { getObject, objectImage } from '../../../data/objects/catalog';
import type { Question } from '../../../engine/types';
import type { ArithmeticPayload } from '../generator';
import type { OperationId } from '../operations';

type ViewProps = { a: number; b: number; image: string; alt: string };

/** Kích thước hình theo số lượng để cả phép tính nằm gọn trên điện thoại. */
function itemSize(total: number): string {
  if (total <= 5) return 'h-14 w-14 sm:h-20 sm:w-20';
  if (total <= 8) return 'h-11 w-11 sm:h-16 sm:w-16';
  return 'h-9 w-9 sm:h-14 sm:w-14';
}

function Group({ count, image, size, crossedFrom = Infinity, delay = 0 }: { count: number; image: string; size: string; crossedFrom?: number; delay?: number }) {
  const perRow = count <= 3 ? count : count <= 6 ? 3 : 5;
  return (
    <div
      className="grid place-items-center gap-1.5 rounded-3xl border-4 border-dashed border-ink/15 bg-white/80 p-2 sm:gap-2 sm:p-3"
      style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => {
        const crossed = i >= crossedFrom;
        return (
          <motion.div
            key={i}
            className={`relative ${size}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={crossed ? { scale: 1, opacity: [0, 1, 1, 0.35], y: [0, 0, 0, -6] } : { scale: 1, opacity: 1 }}
            transition={crossed ? { duration: 1.6, times: [0, 0.3, 0.6, 1], delay: delay + i * 0.08 } : { type: 'spring', stiffness: 300, damping: 18, delay: delay + i * 0.08 }}
          >
            <img src={image} alt="" draggable={false} className="h-full w-full object-contain" />
            {crossed && (
              <motion.span
                className="absolute inset-0 flex items-center justify-center text-bubblegum-500"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: delay + 1 + (i - crossedFrom) * 0.15 }}
                aria-hidden
              >
                <X className="h-full w-full" strokeWidth={3.5} />
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function AdditionView({ a, b, image, alt }: ViewProps) {
  const size = itemSize(a + b);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4" role="img" aria-label={`${a} ${alt} thêm ${b} ${alt}`}>
      <Group count={a} image={image} size={size} />
      <Plus className="h-10 w-10 shrink-0 text-ink/60 sm:h-14 sm:w-14" strokeWidth={4} aria-hidden />
      <Group count={b} image={image} size={size} delay={0.1 * a} />
    </div>
  );
}

function SubtractionView({ a, b, image, alt }: ViewProps) {
  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`${a} ${alt}, bớt đi ${b} ${alt}`}>
      <Group count={a} image={image} size={itemSize(a)} crossedFrom={a - b} />
      <span className="flex items-center gap-1 rounded-full bg-bubblegum-100 px-3 py-1 text-lg font-bold text-bubblegum-500">
        <Minus size={20} strokeWidth={3} /> bớt {b}
      </span>
    </div>
  );
}

const OPERATION_VIEWS: Record<OperationId, ComponentType<ViewProps>> = {
  add: AdditionView,
  sub: SubtractionView,
};

export function ArithmeticQuestionView({ question }: { question: Question<ArithmeticPayload> }) {
  const { op, a, b, objectId } = question.payload;
  const View = OPERATION_VIEWS[op];
  return (
    <div className="flex w-full items-center justify-center py-1" data-testid="arithmetic-display">
      <View a={a} b={b} image={objectImage(objectId)} alt={getObject(objectId)?.label ?? ''} />
    </div>
  );
}

/** Hình minh hoạ trên thẻ chương: "2 + 3" bằng táo. */
export function ArithmeticIllustration() {
  const apple = objectImage('apple');
  return (
    <div className="flex h-full items-center justify-center gap-2 sm:gap-3" aria-hidden>
      {[0, 1].map((i) => (
        <motion.img key={`a${i}`} src={apple} alt="" className="h-10 w-10 sm:h-12 sm:w-12" animate={{ y: [0, -6, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }} />
      ))}
      <Plus className="h-9 w-9 text-[#D9480F]" strokeWidth={4} />
      {[0, 1, 2].map((i) => (
        <motion.img key={`b${i}`} src={apple} alt="" className="h-10 w-10 sm:h-12 sm:w-12" animate={{ y: [0, -6, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: 0.3 + i * 0.15 }} />
      ))}
      <span className="text-4xl font-extrabold text-[#D9480F]">= ?</span>
    </div>
  );
}
