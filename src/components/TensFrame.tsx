/**
 * Hiển thị số 11–100 theo "chục và đơn vị": mỗi chục là một khung 10 hình
 * (2 hàng x 5), cộng thêm các hình lẻ. Ví dụ 13 = [khung 10] + 3 hình.
 */
import { motion } from 'framer-motion';
import { numberWord } from '../data/numbers/numbers';

interface TensFrameProps {
  value: number;
  image: string;
  alt: string;
}

function Item({ image, delay, size }: { image: string; delay: number; size: string }) {
  return (
    <motion.img
      src={image}
      alt=""
      draggable={false}
      className={`${size} object-contain`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 18 }}
    />
  );
}

export function TensFrame({ value, image, alt }: TensFrameProps) {
  const tens = Math.floor(value / 10);
  const units = value % 10;
  const tensWord = numberWord(tens).toLowerCase();
  // Càng nhiều chục thì hình càng nhỏ để thẻ không quá dài.
  const size = tens <= 2 ? 'h-8 w-8 sm:h-11 sm:w-11' : tens <= 5 ? 'h-6 w-6 sm:h-8 sm:w-8' : 'h-5 w-5 sm:h-6 sm:w-6';
  const step = tens <= 2 ? 0.02 : 0.006;
  const label = units === 0 ? `${tensWord} chục ${alt}` : `${tensWord} chục và ${numberWord(units).toLowerCase()} ${alt}`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" role="img" aria-label={label} data-testid="tens-frame">
      {Array.from({ length: tens }, (_, t) => (
        <div key={t} className="grid grid-cols-5 gap-1 rounded-2xl border-4 border-dashed border-ink/20 bg-white p-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <Item key={i} image={image} size={size} delay={step * (t * 10 + i)} />
          ))}
        </div>
      ))}
      {units > 0 && (
        <>
          <span className="text-3xl font-extrabold text-ink/40" aria-hidden>
            +
          </span>
          <div className="grid gap-1 rounded-2xl p-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(units, 5)}, minmax(0, 1fr))` }}>
            {Array.from({ length: units }, (_, i) => (
              <Item key={i} image={image} size={size} delay={step * tens * 10 + 0.12 * (i + 1)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
