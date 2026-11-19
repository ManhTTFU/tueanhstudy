/** Các thành phần giao diện nhỏ dùng chung. */
import { motion } from 'framer-motion';
import { ArrowLeft, Star } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioController } from '../features/audio/AudioController';

export function ProgressBar({ value, max = 100, color = '#4FD08F', label, className = '' }: { value: number; max?: number; color?: string; label?: string; className?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={`w-full ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="h-5 w-full overflow-hidden rounded-full bg-ink/10 p-1">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, value > 0 ? 6 : 0)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

export function Stars({ count, max = 3, size = 28 }: { count: number; max?: number; size?: number }) {
  return (
    <div className="flex gap-1" aria-label={`${count} trên ${max} sao`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={2.5}
          className={i < count ? 'fill-sunny-400 text-sunny-500' : 'fill-ink/5 text-ink/20'}
        />
      ))}
    </div>
  );
}

export function BackButton({ to = '/', label = 'Quay lại' }: { to?: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        AudioController.sfx('tap');
        navigate(to);
      }}
      className="kid-btn bg-white px-4 text-ink"
      aria-label={label}
    >
      <ArrowLeft size={32} strokeWidth={3} />
    </button>
  );
}

export function PageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-playful min-h-screen overflow-x-hidden min-h-[100dvh] px-4 pb-10 pt-4 sm:px-6 ${className}`}>
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}

/**
 * Nút phải GIỮ một lúc mới kích hoạt – dùng cho lối vào khu vực phụ huynh
 * để bé không vô tình bấm vào.
 */
export function HoldButton({
  onHold,
  holdMs = 1500,
  children,
  label,
  className = '',
}: {
  onHold: () => void;
  holdMs?: number;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  const stop = () => {
    start.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setProgress(0);
  };

  const tick = () => {
    if (start.current === null) return;
    const p = Math.min(1, (performance.now() - start.current) / holdMs);
    setProgress(p);
    if (p >= 1) {
      stop();
      onHold();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`relative ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = performance.now();
        raf.current = requestAnimationFrame(tick);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        // Bàn phím: cần nhấn Enter 3 lần liên tiếp
        if (e.key === 'Enter') {
          const n = Number((e.currentTarget.dataset.presses ?? '0')) + 1;
          e.currentTarget.dataset.presses = String(n);
          if (n >= 3) {
            e.currentTarget.dataset.presses = '0';
            onHold();
          }
        }
      }}
    >
      {children}
      {progress > 0 && (
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#7C55E6" strokeWidth="3" strokeDasharray={`${progress * 100.5} 100.5`} />
        </svg>
      )}
    </button>
  );
}

export function LoadingMascotDots() {
  return (
    <div className="flex items-center justify-center gap-2 py-6" aria-label="Đang tải">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-4 w-4 rounded-full bg-sunny-400"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
