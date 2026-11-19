/**
 * Mochi – nhân vật đại diện của ứng dụng (vẽ bằng SVG, thuộc dự án).
 * mood: neutral | happy | sad | cheer | thinking
 */
import { motion } from 'framer-motion';
import { useId } from 'react';

export type MascotMood = 'neutral' | 'happy' | 'sad' | 'cheer' | 'thinking';

interface MascotProps {
  mood?: MascotMood;
  size?: number | string;
  className?: string;
  bounce?: boolean;
  title?: string;
}

const INK = '#3B2F5C';

export function Mascot({ mood = 'neutral', size = 120, className, bounce = true, title = 'Bạn Mochi' }: MascotProps) {
  const id = useId().replace(/:/g, '');
  const armsUp = mood === 'cheer' || mood === 'happy';
  return (
    <motion.div
      className={className}
      style={{ width: size, height: size }}
      animate={bounce ? (mood === 'cheer' ? { y: [0, -14, 0], rotate: [0, -4, 4, 0] } : { y: [0, -5, 0] }) : undefined}
      transition={{ duration: mood === 'cheer' ? 0.7 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-label={title}>
        <defs>
          <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD58F" />
            <stop offset="1" stopColor="#FFA94D" />
          </linearGradient>
        </defs>
        {/* Bóng dưới chân */}
        <ellipse cx="100" cy="190" rx="52" ry="7" fill={INK} opacity="0.1" />
        {/* Tay */}
        {armsUp ? (
          <>
            <ellipse cx="30" cy="98" rx="13" ry="20" fill="#FFB25A" transform="rotate(-35 30 98)" />
            <ellipse cx="170" cy="98" rx="13" ry="20" fill="#FFB25A" transform="rotate(35 170 98)" />
          </>
        ) : (
          <>
            <ellipse cx="30" cy="146" rx="12" ry="18" fill="#FFB25A" transform="rotate(20 30 146)" />
            <ellipse cx="170" cy="146" rx="12" ry="18" fill="#FFB25A" transform="rotate(-20 170 146)" />
          </>
        )}
        {/* Tai */}
        <circle cx="50" cy="56" r="26" fill="#FFB860" />
        <circle cx="150" cy="56" r="26" fill="#FFB860" />
        <circle cx="50" cy="58" r="13" fill="#FF9EC4" />
        <circle cx="150" cy="58" r="13" fill="#FF9EC4" />
        {/* Thân */}
        <ellipse cx="100" cy="114" rx="78" ry="72" fill={`url(#body-${id})`} />
        <ellipse cx="100" cy="134" rx="48" ry="36" fill="#FFF3DF" />
        {/* Mầm cây trên đầu */}
        <path d="M100 44 C100 34 101 28 104 22" stroke="#22B573" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M104 24 C110 12 124 12 128 18 C122 28 110 30 104 24 Z" fill="#4FD08F" />
        <path d="M102 28 C94 18 82 20 79 26 C86 34 97 33 102 28 Z" fill="#8BE3BC" />
        {/* Má hồng */}
        <ellipse cx="58" cy="126" rx="12" ry="7" fill="#FF9EC4" opacity="0.75" />
        <ellipse cx="142" cy="126" rx="12" ry="7" fill="#FF9EC4" opacity="0.75" />
        {/* Mắt */}
        {mood === 'happy' || mood === 'cheer' ? (
          <>
            <path d="M64 106 Q76 92 88 106" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M112 106 Q124 92 136 106" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            {mood === 'sad' && (
              <>
                <path d="M62 86 L84 81" stroke={INK} strokeWidth="4" strokeLinecap="round" />
                <path d="M116 81 L138 86" stroke={INK} strokeWidth="4" strokeLinecap="round" />
              </>
            )}
            <ellipse cx="76" cy="104" rx="8" ry={mood === 'sad' ? 8 : 10} fill={INK} />
            <ellipse cx="124" cy="104" rx="8" ry={mood === 'sad' ? 8 : 10} fill={INK} />
            <circle cx="79" cy="100" r="3" fill="#fff" />
            <circle cx="127" cy="100" r="3" fill="#fff" />
          </>
        )}
        {/* Miệng */}
        {mood === 'happy' || mood === 'cheer' ? (
          <>
            <path d="M84 124 Q100 150 116 124 Z" fill="#7A2E3B" />
            <ellipse cx="100" cy="137" rx="8" ry="4.5" fill="#FF7BAC" />
          </>
        ) : mood === 'sad' ? (
          <path d="M90 138 Q100 130 110 138" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        ) : mood === 'thinking' ? (
          <circle cx="104" cy="132" r="5" fill="#7A2E3B" />
        ) : (
          <path d="M88 126 Q100 138 112 126" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        )}
        {/* Lấp lánh khi cổ vũ */}
        {mood === 'cheer' && (
          <g fill="#FFD23F">
            <path d="M22 40 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" />
            <path d="M178 30 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}
