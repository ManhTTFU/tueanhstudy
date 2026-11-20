/**
 * Giao diện chung của nhóm 5–9 tuổi: đề bài, phép tính, dãy, tháp số, mẹo
 * và bảng "Cùng nghĩ từng bước" (hiện sau lần trả lời sai đầu tiên).
 */
import { motion } from 'framer-motion';
import { Check, Lightbulb } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { AudioController } from '../../../features/audio/AudioController';
import type { Question } from '../../../engine/types';
import { stepNumberChoices, type PrimaryPayload, type Step } from '../kit';

type PQ = Question<PrimaryPayload>;

/** Chữ có ô trống "□" => vẽ ô trống nét đứt. */
function WithBlanks({ text }: { text: string }) {
  const parts = text.split('□');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className="mx-1 inline-flex min-w-[1.6em] items-center justify-center rounded-xl border-4 border-dashed border-grape-400 bg-grape-100 px-1 align-middle text-grape-500" aria-label="ô trống">
              ?
            </span>
          )}
        </span>
      ))}
    </>
  );
}

function Pyramid({ rows }: { rows: (number | null)[][] }) {
  return (
    <div className="flex flex-col items-center gap-1.5" aria-label="Tháp số">
      {rows.map((row, r) => (
        <div key={r} className="flex gap-1.5">
          {row.map((v, c) => (
            <span
              key={c}
              className={`flex h-14 w-16 items-center justify-center rounded-xl text-2xl font-extrabold sm:h-16 sm:w-20 sm:text-3xl ${
                v === null ? 'border-4 border-dashed border-grape-400 bg-grape-100 text-grape-500' : 'bg-sky-100 text-ink'
              }`}
            >
              {v ?? '?'}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Thứ tự cố định theo câu hỏi (không nhảy lung tung mỗi lần vẽ lại). */
function stableShuffle<T>(items: T[], seed: string, key: (t: T) => string): T[] {
  const h = (s: string) => {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0;
    return x;
  };
  return [...items].sort((a, b) => h(seed + key(a)) - h(seed + key(b)));
}

function StepChips({ step, seed, onSolved }: { step: Step; seed: string; onSolved: () => void }) {
  const [tried, setTried] = useState<number[]>([]);
  const chips = useMemo(() => {
    if (step.choices) {
      return stableShuffle(
        step.choices.map((label, value) => ({ value, label })),
        seed,
        (c) => c.label,
      );
    }
    return stepNumberChoices(step.a, seed).map((value) => ({ value, label: String(value) }));
  }, [step, seed]);
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const off = tried.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            disabled={off}
            data-testid="step-choice"
            onClick={() => {
              if (c.value === step.a) {
                AudioController.sfx('correct');
                onSolved();
              } else {
                AudioController.sfx('wrong');
                setTried((t) => [...t, c.value]);
              }
            }}
            className={`min-h-[52px] min-w-[64px] rounded-2xl border-4 border-sky-300 bg-white px-4 text-xl font-extrabold shadow-pop-sm active:translate-y-0.5 ${off ? 'opacity-30' : ''}`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function stepAnswerText(step: Step) {
  return step.choices ? step.choices[step.a]! : String(step.a);
}

/** Dẫn bé giải từng bước nhỏ; xong thì nhắc bé trả lời câu chính. */
function StepsPanel({ question }: { question: PQ }) {
  const steps = question.payload.steps ?? [];
  const [done, setDone] = useState(0);
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-3xl border-4 border-sky-300 bg-sky-100 p-4 text-left"
      aria-label="Cùng nghĩ từng bước"
      data-testid="steps-panel"
    >
      <p className="mb-2 text-xl font-extrabold text-sky-500">Cùng nghĩ từng bước nhé!</p>
      <ol className="flex flex-col gap-3">
        {steps.slice(0, done + 1).map((s, i) => (
          <li key={i} className="flex flex-col gap-2">
            <span className="text-lg font-bold sm:text-xl">
              Bước {i + 1}: {s.q}
            </span>
            {i < done ? (
              <span className="flex items-center gap-1 text-lg font-extrabold text-mint-500">
                <Check size={22} strokeWidth={4} /> {stepAnswerText(s)}
              </span>
            ) : (
              i < steps.length && <StepChips step={s} seed={`${question.id}:${i}`} onSolved={() => setDone((d) => d + 1)} />
            )}
          </li>
        ))}
      </ol>
      {done >= steps.length && (
        <p className="mt-3 text-xl font-extrabold text-grape-500" data-testid="steps-done">
          Giỏi lắm! Giờ con {question.input ? 'nhập đáp án vào bảng số' : 'chọn đáp án'} nhé.
        </p>
      )}
    </motion.section>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="card flex w-full max-w-3xl flex-col items-center gap-4 p-4 text-center sm:p-6">{children}</div>;
}

export function PrimaryQuestionView({ question, wrongTries = 0 }: { question: PQ; wrongTries?: number }) {
  const p = question.payload;
  const [showTip, setShowTip] = useState(false);
  return (
    <Card>
      {p.text && (
        <p className="w-full text-left text-xl font-semibold leading-relaxed sm:text-2xl" data-testid="primary-text">
          {p.text}
        </p>
      )}
      {p.lines && (
        <div className="flex flex-col gap-1 text-3xl font-extrabold tracking-wide sm:text-4xl">
          {p.lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
      {p.seq && (
        <div className="flex flex-wrap justify-center gap-2" aria-label="Dãy">
          {p.seq.map((v, i) => (
            <span
              key={i}
              className={`flex h-14 min-w-[3.5rem] items-center justify-center rounded-2xl px-2 text-2xl font-extrabold sm:h-16 sm:text-3xl ${
                v === '□' ? 'border-4 border-dashed border-grape-400 bg-grape-100 text-grape-500' : 'bg-sunny-100'
              }`}
            >
              {v === '□' ? '?' : v}
            </span>
          ))}
        </div>
      )}
      {p.pyramid && <Pyramid rows={p.pyramid} />}
      {p.eq && (
        <p className="text-5xl font-extrabold tracking-wide sm:text-6xl" data-testid="primary-eq">
          <WithBlanks text={p.eq} />
        </p>
      )}
      {p.ask && <p className="w-full text-left text-xl font-extrabold text-grape-500 sm:text-2xl">{p.ask}</p>}

      {p.tip && (
        <div className="flex w-full flex-col items-start gap-2">
          <button type="button" className="flex items-center gap-1 rounded-full bg-sunny-100 px-4 py-2 font-bold" onClick={() => setShowTip((v) => !v)}>
            <Lightbulb size={20} className="text-sunny-500" /> Mẹo
          </button>
          {showTip && <p className="text-left text-lg font-semibold text-ink/80">{p.tip}</p>}
        </div>
      )}

      {wrongTries > 0 && p.steps && p.steps.length > 0 && <StepsPanel question={question} />}
    </Card>
  );
}

export function PrimaryOption({ value, question }: { value: number; question: PQ }) {
  const label = question.payload.choices?.[String(value)] ?? String(value);
  const emojiOnly = !/[a-zà-ỹđ0-9]/i.test(label);
  return <span className={emojiOnly ? 'text-5xl sm:text-6xl' : 'px-2 text-2xl leading-tight sm:text-3xl'}>{label}</span>;
}

export function primaryOptionLabel(value: number, question: PQ): string {
  return question.payload.choices?.[String(value)] ?? `Số ${value}`;
}

export function PrimaryIllustration({ emoji }: { emoji: string }) {
  return (
    <motion.span className="select-none" style={{ fontSize: '4.5rem' }} animate={{ y: [0, -8, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity }} aria-hidden>
      {emoji}
    </motion.span>
  );
}
