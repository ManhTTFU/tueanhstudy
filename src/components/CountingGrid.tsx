/**
 * Lưới hiển thị N hình để bé đếm.
 *  - Bố cục tự đổi theo số lượng (ví dụ 7 = 4 + 3, 10 = 5 + 5), các hàng căn giữa.
 *  - Hình cùng kích thước, có khoảng cách, không chồng lấn, không bị cắt.
 *  - Xuất hiện lần lượt để bé tập trung.
 *  - Chạm vào từng hình để đếm: hình được đánh số 1, 2, 3... và đọc to.
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AudioController } from '../features/audio/AudioController';

export const GRID_ROWS: Record<number, number[]> = {
  1: [1],
  2: [2],
  3: [3],
  4: [2, 2],
  5: [3, 2],
  6: [3, 3],
  7: [4, 3],
  8: [4, 4],
  9: [3, 3, 3],
  10: [5, 5],
};

/** Chia N hình thành các hàng (dùng được cho cả N > 10 ở các chương sau). */
export function layoutRows(count: number): number[] {
  const preset = GRID_ROWS[count];
  if (preset) return preset;
  const perRow = Math.ceil(Math.sqrt(count * 1.6));
  const rows: number[] = [];
  for (let left = count; left > 0; left -= perRow) rows.push(Math.min(perRow, left));
  return rows;
}

interface CountingGridProps {
  count: number;
  image: string;
  alt: string;
  /** Cho phép chạm để đếm. */
  tapToCount?: boolean;
  /** Đổi giá trị để reset trạng thái đếm (ví dụ id câu hỏi). */
  resetKey?: string | number;
  maxItemSize?: number;
  className?: string;
}

export function CountingGrid({
  count,
  image,
  alt,
  tapToCount = true,
  resetKey,
  maxItemSize = 132,
  className = '',
}: CountingGridProps) {
  const rows = layoutRows(count);
  const maxCols = Math.max(...rows);
  const [counted, setCounted] = useState<Record<number, number>>({});

  useEffect(() => setCounted({}), [resetKey, count]);

  const handleTap = (index: number) => {
    if (!tapToCount || counted[index] !== undefined) return;
    const next = Object.keys(counted).length + 1;
    setCounted((c) => ({ ...c, [index]: next }));
    AudioController.sfx('pop');
    void AudioController.speakNumber(next);
  };

  // Chỉ dùng <button> khi có thể chạm đếm (tránh nút lồng trong nút, ví dụ thẻ học).
  const Item = tapToCount ? motion.button : motion.div;
  let index = 0;
  return (
    <div className={`flex w-full flex-col items-center gap-3 sm:gap-4 ${className}`} data-testid="counting-grid" data-count={count}>
      {rows.map((itemsInRow, r) => (
        <div key={r} className="flex w-full justify-center gap-3 sm:gap-4">
          {Array.from({ length: itemsInRow }, () => {
            const i = index++;
            const n = counted[i];
            return (
              <Item
                {...(tapToCount ? { type: 'button' as const } : { role: 'img' })}
                key={i}
                data-testid="counting-item"
                aria-label={n ? `${alt} thứ ${n}` : alt}
                onClick={() => handleTap(i)}
                initial={{ opacity: 0, scale: 0.4, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 18 }}
                className={`relative aspect-square rounded-3xl p-[8%] transition-colors ${
                  n ? 'bg-sunny-100 ring-4 ring-sunny-400' : 'bg-white/70'
                } ${tapToCount ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                style={{
                  flex: `0 1 calc((100% - ${(maxCols - 1) * 1}rem) / ${maxCols})`,
                  maxWidth: maxItemSize,
                }}
              >
                <img src={image} alt="" draggable={false} className="pointer-events-none absolute inset-[8%] h-[84%] w-[84%] object-contain" />
                {n !== undefined && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-bubblegum-500 text-xl font-extrabold text-white shadow-pop-sm"
                  >
                    {n}
                  </motion.span>
                )}
              </Item>
            );
          })}
        </div>
      ))}
    </div>
  );
}
