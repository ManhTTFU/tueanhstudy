/** Các chủ đề nằm trong một chương (vd. "Sân chơi tư duy" trong "Sân chơi trí tuệ"), dạng ô nhỏ. */
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLevels, isChapterUnlocked, LEVEL_UNLOCK_MIN_SCORE } from '../../chapters/levels';
import type { AnyChapter } from '../../chapters/registry';
import { ProgressBar } from '../../components/ui';
import type { Summary } from '../../services/api';
import { AudioController } from '../audio/AudioController';

/** "Sân chơi tư duy": các chủ đề dạng ô nhỏ, hiện số cấp đã vượt qua. */
export function TopicShelf({ topics, summary, title = 'Chọn chủ đề' }: { topics: AnyChapter[]; summary: Summary | null; title?: string }) {
  const navigate = useNavigate();
  const best = (id: string) => summary?.chapters.find((c) => c.chapterId === id)?.bestScore ?? 0;
  return (
    <section className="mx-auto mt-6 max-w-2xl" aria-label="Chủ đề tư duy" data-testid="topic-shelf">
      <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold">
        <Sparkles className="text-sunny-500" /> {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {topics.map((t, i) => {
          const levels = getLevels(t.id);
          const passed = levels.filter((l) => l.games.every((g) => best(g.id) >= LEVEL_UNLOCK_MIN_SCORE)).length;
          const open = levels.filter((l) => l.games.every((g) => isChapterUnlocked(g, best))).length;
          return (
            <motion.button
              key={t.id}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i }}
              className="card flex flex-col items-center gap-1 p-3 text-center active:scale-95"
              style={{ backgroundColor: t.theme.soft }}
              onClick={() => {
                AudioController.sfx('tap');
                navigate(`/chuong/${t.id}?cap=${open}`);
              }}
              data-testid="topic-tile"
              data-chapter={t.id}
            >
              <span className="text-5xl leading-none" aria-hidden>
                {t.icon}
              </span>
              <span className="text-lg font-extrabold" style={{ color: t.theme.strong }}>
                {t.name}
              </span>
              <span className="text-sm font-bold text-ink/60">
                {passed}/{levels.length} cấp
              </span>
              <ProgressBar value={passed} max={levels.length} color={t.theme.primary} label={`${t.name}: đã qua ${passed} cấp`} />
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

