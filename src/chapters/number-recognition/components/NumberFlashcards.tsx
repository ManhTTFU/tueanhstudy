/**
 * Giai đoạn A – học bằng thẻ số 1–10.
 * Chữ số lớn, chữ đọc, hình minh họa đúng số lượng, nút nghe đọc,
 * chuyển thẻ trước/sau, thanh tiến độ, xem lại các thẻ đã học.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Gamepad2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CountingGrid } from '../../../components/CountingGrid';
import { ProgressBar } from '../../../components/ui';
import { NUMBER_CARDS } from '../../../data/numbers/numbers';
import { getObject, objectImage } from '../../../data/objects/catalog';
import { VOICE_PHRASES } from '../../../data/voice';
import { AudioController } from '../../../features/audio/AudioController';

export function NumberFlashcards({ onFinished }: { onFinished: () => void }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const card = NUMBER_CARDS[index]!;
  const total = NUMBER_CARDS.length;
  const allVisited = visited.size === total;

  const speakCard = () => {
    void AudioController.speak({ file: `cards/${card.value}`, text: `Số ${card.word}. ${card.caption}.` });
  };

  useEffect(() => {
    speakCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const go = (next: number) => {
    if (next < 0 || next >= total) return;
    AudioController.sfx('flip');
    setDirection(next > index ? 1 : -1);
    setIndex(next);
    setVisited((v) => new Set(v).add(next));
  };

  const object = getObject(card.objectId);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-xl items-center gap-3">
        <ProgressBar value={visited.size} max={total} color={card.color} label="Tiến độ học thẻ" />
        <span className="shrink-0 text-2xl font-extrabold" data-testid="card-progress">
          {index + 1}/{total}
        </span>
      </div>

      <div className="relative w-full max-w-xl">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.button
            type="button"
            key={card.value}
            custom={direction}
            onClick={speakCard}
            aria-label={`Thẻ số ${card.value}: ${card.caption}. Chạm để nghe lại`}
            initial={{ x: direction * 260, opacity: 0, rotate: direction * 6 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: direction * -260, opacity: 0, rotate: direction * -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="card flex w-full flex-col items-center gap-2 overflow-hidden p-5 sm:p-7"
            style={{ borderTop: `14px solid ${card.color}` }}
            data-testid="number-card"
          >
            <div className="flex w-full items-start justify-between">
              <span className="text-4xl font-extrabold sm:text-5xl" style={{ color: card.color }}>
                {card.word}
              </span>
              <span className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-pop-sm" style={{ backgroundColor: card.color }}>
                <Volume2 size={34} strokeWidth={2.6} />
              </span>
            </div>
            <span className="font-extrabold leading-none" style={{ color: card.color, fontSize: 'clamp(7rem, 24vmin, 11rem)' }}>
              {card.value}
            </span>
            {object && (
              <CountingGrid
                count={card.value}
                image={objectImage(object.id)}
                alt={object.label}
                resetKey={card.value}
                maxItemSize={88}
                tapToCount={false}
              />
            )}
            <span className="mt-1 text-2xl font-bold text-ink/80 sm:text-3xl">{card.caption}</span>
          </motion.button>
        </AnimatePresence>
      </div>

      <div className="flex w-full max-w-xl items-center justify-between gap-3">
        <button type="button" className="kid-btn bg-white text-ink" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Thẻ trước">
          <ChevronLeft size={40} strokeWidth={3} />
        </button>
        {index < total - 1 ? (
          <button type="button" className="kid-btn flex-1 bg-sunny-400 text-ink" onClick={() => go(index + 1)} aria-label="Thẻ tiếp theo">
            Tiếp nào <ChevronRight size={36} strokeWidth={3} />
          </button>
        ) : (
          <button
            type="button"
            className="kid-btn flex-1 bg-mint-400 text-white"
            onClick={() => {
              void AudioController.speak(VOICE_PHRASES.finishCards);
              onFinished();
            }}
            disabled={!allVisited}
            data-testid="finish-cards"
          >
            <Gamepad2 size={34} strokeWidth={2.6} /> Chơi thôi!
          </button>
        )}
      </div>

      {/* Xem lại các thẻ đã học */}
      <div className="flex flex-wrap justify-center gap-2" aria-label="Xem lại thẻ đã học">
        {NUMBER_CARDS.map((c, i) => {
          const seen = visited.has(i);
          return (
            <button
              key={c.value}
              type="button"
              disabled={!seen}
              onClick={() => go(i)}
              aria-label={`Xem lại số ${c.value}`}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-extrabold transition-transform active:scale-95 ${
                i === index ? 'scale-110 text-white shadow-pop-sm' : seen ? 'bg-white text-ink shadow-pop-sm' : 'bg-ink/5 text-ink/25'
              }`}
              style={i === index ? { backgroundColor: c.color } : undefined}
            >
              {c.value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
