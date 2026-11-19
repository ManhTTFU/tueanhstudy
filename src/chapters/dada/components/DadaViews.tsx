/**
 * Giao diện chung của "Sân chơi tư duy": vẽ mọi Visual / Block mô tả trong kit.ts.
 * Hình con vật, đồ vật dùng emoji của máy; bóng bay, hình khối, đồng hồ vẽ bằng SVG.
 */
import { motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import type { Block, DadaPayload, ShapeId, Visual } from '../kit';
import { visualLabel } from '../kit';
import type { Question } from '../../../engine/types';
import { NumberWithDots } from '../../../components/NumberDots';

type Size = 'xl' | 'lg' | 'md' | 'sm' | 'opt';
const EM: Record<Size, string> = { xl: 'clamp(5rem, 22vmin, 8rem)', lg: 'clamp(3.5rem, 16vmin, 5.5rem)', md: 'clamp(2.4rem, 10vmin, 3.6rem)', sm: 'clamp(1.6rem, 7vmin, 2.4rem)', opt: 'clamp(2.8rem, 13vmin, 4.4rem)' };

function shapePath(s: ShapeId): JSX.Element {
  switch (s) {
    case 'circle':
      return <circle cx="50" cy="50" r="40" />;
    case 'square':
      return <rect x="12" y="12" width="76" height="76" rx="6" />;
    case 'rect':
      return <rect x="6" y="24" width="88" height="52" rx="6" />;
    case 'triangle':
      return <polygon points="50,8 94,88 6,88" />;
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 19 : 44;
        return `${(50 + r * Math.cos(a)).toFixed(1)},${(52 + r * Math.sin(a)).toFixed(1)}`;
      });
      return <polygon points={pts.join(' ')} />;
    }
    case 'heart':
      return <path d="M50 88 C20 66 6 48 6 32 C6 18 17 8 30 8 C40 8 47 14 50 22 C53 14 60 8 70 8 C83 8 94 18 94 32 C94 48 80 66 50 88 Z" />;
  }
}

function Clock({ h, size }: { h: number; size: string }) {
  const a = ((h % 12) / 12) * 2 * Math.PI;
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }} aria-hidden>
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#3B2F5C" strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => {
        const t = (i / 12) * 2 * Math.PI;
        return (
          <text key={i} x={50 + 34 * Math.sin(t)} y={50 - 34 * Math.cos(t) + 4} fontSize="11" fontWeight="800" textAnchor="middle" fill="#3B2F5C">
            {i === 0 ? 12 : i}
          </text>
        );
      })}
      <line x1="50" y1="50" x2={50 + 20 * Math.sin(a)} y2={50 - 20 * Math.cos(a)} stroke="#3B2F5C" strokeWidth="6" strokeLinecap="round" />
      <line x1="50" y1="50" x2="50" y2="16" stroke="#EF3B3B" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="4" fill="#3B2F5C" />
    </svg>
  );
}

export function VisualView({ v, size }: { v: Visual; size: Size }) {
  const fs = EM[size];
  switch (v.t) {
    case 'emoji': {
      const style: CSSProperties = { fontSize: `calc(${fs} * ${v.scale ?? 1})`, lineHeight: 1 };
      if (v.shadow) style.filter = 'brightness(0)';
      return (
        <span className="inline-block select-none" style={style} aria-hidden>
          {v.e}
        </span>
      );
    }
    case 'balloon':
      return (
        <svg viewBox="0 0 60 92" style={{ height: `calc(${fs} * 1.2)` }} aria-hidden>
          <path d="M30 4C14 4 6 18 6 32c0 18 14 30 24 34 10-4 24-16 24-34C54 18 46 4 30 4z" fill={v.c} stroke="#0002" strokeWidth="1.5" />
          <path d="M26 66h8l-4 6z" fill={v.c} />
          <path d="M30 72c-5 6 5 11 0 18" stroke="#7A8799" strokeWidth="2" fill="none" />
          <ellipse cx="20" cy="22" rx="5" ry="9" fill="#fff" opacity=".45" />
        </svg>
      );
    case 'color':
      return (
        <span className="flex flex-col items-center gap-1">
          <span className="block rounded-full border-4 border-white shadow-pop-sm" style={{ backgroundColor: v.c, width: `calc(${fs} * 0.9)`, height: `calc(${fs} * 0.9)` }} />
          <span className="text-base font-extrabold text-ink sm:text-lg">{v.n}</span>
        </span>
      );
    case 'shape':
      return (
        <svg viewBox="0 0 100 100" style={{ width: `calc(${fs} * ${v.scale ?? 1.1})`, height: `calc(${fs} * ${v.scale ?? 1.1})` }} fill={v.c} stroke="#0003" strokeWidth="3" aria-hidden>
          {shapePath(v.s)}
        </svg>
      );
    case 'text':
      return (
        <span className="font-extrabold leading-tight text-ink" style={{ fontSize: v.v.length > 4 ? `calc(${fs} * 0.55)` : `calc(${fs} * 0.9)` }}>
          {v.v}
        </span>
      );
    case 'group':
      return (
        <span className="flex max-w-[11rem] flex-wrap items-center justify-center gap-0.5" aria-hidden>
          {v.items.map((it, i) => (
            <VisualView key={i} v={it} size={v.items.length > 6 ? 'sm' : size === 'opt' ? 'sm' : size} />
          ))}
        </span>
      );
    case 'row':
      return (
        <span className="flex flex-wrap items-center justify-center gap-1" aria-hidden>
          {v.items.map((it, i) => (
            <VisualView key={i} v={it} size={size === 'opt' ? 'sm' : size} />
          ))}
        </span>
      );
    case 'clock':
      return <Clock h={v.h} size={`calc(${fs} * 1.8)`} />;
    case 'q':
      return (
        <span className="flex items-center justify-center rounded-2xl border-4 border-dashed border-ink/25 text-ink/50" style={{ width: fs, height: fs }}>
          <HelpCircle style={{ width: '60%', height: '60%' }} strokeWidth={3} />
        </span>
      );
    case 'blank':
      return <span style={{ width: fs, height: fs }} className="inline-block" />;
  }
}

const OPEN = { up: 1, right: 2, down: 4, left: 8 };
function Maze({ w, open, marks }: { w: number; open: number[]; marks: Record<string, Visual> }) {
  const cell = `min(${(86 / w).toFixed(2)}vw, ${(22 / w).toFixed(2)}rem)`;
  const wall = '4px solid #3B2F5C';
  return (
    <div className="inline-grid rounded-xl bg-white p-1 shadow-soft" style={{ gridTemplateColumns: `repeat(${w}, ${cell})` }} data-testid="maze">
      {open.map((o, i) => (
        <div
          key={i}
          className="flex items-center justify-center"
          style={{
            height: cell,
            borderTop: o & OPEN.up ? '4px solid transparent' : wall,
            borderRight: o & OPEN.right ? '4px solid transparent' : wall,
            borderBottom: o & OPEN.down ? '4px solid transparent' : wall,
            borderLeft: o & OPEN.left ? '4px solid transparent' : wall,
            margin: -2,
          }}
        >
          {marks[String(i)] && <VisualView v={marks[String(i)]!} size="sm" />}
        </div>
      ))}
    </div>
  );
}

function Flash({ block }: { block: Extract<Block, { t: 'flash' }> }) {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setAfter(true), block.ms);
    return () => window.clearTimeout(t);
  }, [block.ms]);
  return (
    <motion.div key={after ? 'then' : 'show'} initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} className="flex flex-col items-center gap-3" data-testid={after ? 'flash-then' : 'flash-show'}>
      {(after ? block.then : block.show).map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </motion.div>
  );
}

function Labelled({ label, children }: { label?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col items-center rounded-4xl bg-white/90 px-3 pb-3 pt-4 shadow-soft">
      {label && <span className="absolute -top-3 rounded-full bg-sunny-400 px-3 text-sm font-bold text-ink">{label}</span>}
      {children}
    </div>
  );
}

export function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case 'row':
      return (
        <Labelled label={block.label}>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {block.items.map((v, i) => (
              <VisualView key={i} v={v} size={block.size ?? 'md'} />
            ))}
          </div>
        </Labelled>
      );
    case 'grid':
      return (
        <Labelled label={block.label}>
          <div className="grid place-items-center gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${block.cols}, minmax(0, 1fr))` }}>
            {block.cells.map((v, i) => (
              <VisualView key={i} v={v} size={block.size ?? 'md'} />
            ))}
          </div>
        </Labelled>
      );
    case 'pair':
      return (
        <div className="flex flex-wrap items-start justify-center gap-3">
          <BlockView block={block.left} />
          <BlockView block={block.right} />
        </div>
      );
    case 'flash':
      return <Flash block={block} />;
    case 'text':
      return <p className={`rounded-3xl bg-white/90 px-5 py-2 text-center font-extrabold text-ink shadow-soft ${block.big ? 'text-6xl tracking-wider' : 'text-xl'}`}>{block.v}</p>;
    case 'maze':
      return <Maze w={block.w} open={block.open} marks={block.marks} />;
  }
}

export function DadaQuestionView({ question }: { question: Question<DadaPayload> }) {
  return (
    <div className="flex w-full flex-col items-center gap-3 py-1" data-testid="dada-question">
      {question.payload.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

export function DadaOption({ value, question }: { value: number; question: Question<DadaPayload> }) {
  const v = question.payload.choices?.[String(value)];
  if (!v) return <NumberWithDots value={value} />;
  return <VisualView v={v} size="opt" />;
}

export function dadaOptionLabel(value: number, question: Question<DadaPayload>): string {
  const v = question.payload.choices?.[String(value)];
  return v ? visualLabel(v) : `Số ${value}`;
}

export function DadaIllustration({ icon }: { icon: string }) {
  return (
    <motion.span className="select-none" style={{ fontSize: '4.5rem' }} animate={{ y: [0, -8, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity }} aria-hidden>
      {icon}
    </motion.span>
  );
}
