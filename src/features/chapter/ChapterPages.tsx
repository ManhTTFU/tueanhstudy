/** Trang giới thiệu chương và trang học (giai đoạn A) – dùng chung cho mọi chương. */
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getChapter } from '../../chapters/registry';
import { getChapterUI } from '../../chapters/ui-registry';
import { Mascot } from '../../components/Mascot';
import { BackButton, PageShell } from '../../components/ui';
import { api } from '../../services/api';
import { AudioController } from '../audio/AudioController';

function useChapterParams() {
  const { chapterId = '' } = useParams();
  const chapter = getChapter(chapterId);
  const ui = getChapterUI(chapterId);
  return chapter && chapter.enabled && ui ? { chapter, ui } : null;
}

export function ChapterIntroPage() {
  const found = useChapterParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (found) void AudioController.speak(found.ui.introVoice);
  }, [found?.chapter.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!found) return <Navigate to="/" replace />;
  const { chapter, ui } = found;
  const { Illustration, Learning } = ui;

  return (
    <PageShell>
      <BackButton to="/" />
      <motion.div
        className="card mx-auto mt-4 flex max-w-2xl flex-col items-center gap-4 overflow-hidden pb-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex h-40 w-full items-center justify-center" style={{ backgroundColor: chapter.theme.soft }}>
          <Illustration />
        </div>
        <Mascot mood="happy" size={110} />
        <h1 className="px-4 text-4xl font-extrabold uppercase sm:text-5xl" style={{ color: chapter.theme.strong }}>
          {chapter.name}
        </h1>
        <p className="px-4 text-2xl font-semibold text-ink/70">{chapter.description}</p>
        <div className="flex w-full flex-col gap-3 px-6 sm:flex-row">
          {Learning && (
            <button
              type="button"
              className="kid-btn flex-1 bg-sunny-400 text-ink"
              onClick={() => {
                AudioController.sfx('tap');
                navigate(`/chuong/${chapter.id}/hoc`);
              }}
              data-testid="start-learning"
            >
              <Learning.Icon size={32} strokeWidth={2.6} /> {Learning.label}
            </button>
          )}
          <button
            type="button"
            className="kid-btn flex-1 text-white"
            style={{ backgroundColor: chapter.theme.primary }}
            onClick={() => {
              AudioController.sfx('tap');
              navigate(`/chuong/${chapter.id}/choi`);
            }}
            data-testid="start-quiz"
          >
            <Gamepad2 size={32} strokeWidth={2.6} /> Chơi ngay
          </button>
        </div>
      </motion.div>
    </PageShell>
  );
}

export function LearningPage() {
  const found = useChapterParams();
  const navigate = useNavigate();
  if (!found || !found.ui.Learning) return <Navigate to="/" replace />;
  const { chapter, ui } = found;
  const View = ui.Learning!.View;
  return (
    <PageShell>
      <div className="mb-3 flex items-center gap-3">
        <BackButton to={`/chuong/${chapter.id}`} />
        <h1 className="text-3xl font-extrabold" style={{ color: chapter.theme.strong }}>
          {ui.Learning!.label}
        </h1>
      </div>
      <View
        onFinished={() => {
          api.completeLearning(chapter.id).catch(() => undefined);
          navigate(`/chuong/${chapter.id}/choi`);
        }}
      />
    </PageShell>
  );
}
