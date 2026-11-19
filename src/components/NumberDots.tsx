/**
 * N chấm bi dưới chữ số (chỉ cho số nguyên 1–10) để bé vừa nhìn số vừa đếm.
 * Xếp theo khung mười: tối đa 5 chấm một hàng (7 = 5 + 2), màu theo chữ (currentColor).
 */
const SIZES = {
  sm: 'h-2.5 w-2.5 sm:h-3 sm:w-3',
  md: 'h-4 w-4 sm:h-5 sm:w-5',
  lg: 'h-5 w-5 sm:h-7 sm:w-7',
} as const;

export const MAX_DOTS = 10;

export function hasDots(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_DOTS;
}

export function NumberDots({ value, size = 'sm', className = '' }: { value: unknown; size?: keyof typeof SIZES; className?: string }) {
  if (!hasDots(value)) return null;
  const rows = value > 5 ? [5, value - 5] : [value];
  return (
    <span className={`flex flex-col items-center gap-1 sm:gap-1.5 ${className}`} aria-hidden data-testid="number-dots" data-count={value}>
      {rows.map((count, r) => (
        <span key={r} className="flex gap-1 sm:gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={`${SIZES[size]} rounded-full bg-current`} />
          ))}
        </span>
      ))}
    </span>
  );
}

/** Chữ số kèm chấm bi bên dưới (dùng cho ô đáp án là số). */
export function NumberWithDots({ value }: { value: number }) {
  return (
    <span className="flex flex-col items-center gap-1.5 sm:gap-2">
      <span className="leading-none">{value}</span>
      <NumberDots value={value} />
    </span>
  );
}
