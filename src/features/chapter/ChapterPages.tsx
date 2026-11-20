/** Trang giới thiệu chương và trang học (giai đoạn A) – dùng chung cho mọi chương. */
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, Gamepad2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  chapterLevel,
  getLevels,
  groupRootId,
  isChapterUnlocked,
  LEVEL_UNLOCK_MIN_SCORE,
  unlockRequirements,
  type ChapterLevel,
} from '../../chapters/levels';
import { getChapter, getHubChapters, type AnyChapter } from '../../chapters/registry';
import { getChapterUI } from '../../chapters/ui-registry';
import { Mascot } from '../../components/Mascot';
import { BackButton, PageShell } from '../../components/ui';
import { VOICE_PHRASES } from '../../data/voice';
import { useApiData } from '../../hooks/useApiData';
import { api } from '../../services/api';
import { AudioController } from '../audio/AudioController';
import { TopicShelf } from './TopicShelf';

function useChapterParams() {
  const { chapterId = '' } = useParams();
  const chapter = getChapter(chapterId);
  const ui = getChapterUI(chapterId);
  return chapter && chapter.enabled && ui ? { chapter, ui } : null;
}

/** Trang chương (đúng cấp) của một trò chơi – dùng cho nút quay lại. */
export function chapterPagePath(chapter: AnyChapter): string {
  const level = chapterLevel(chapter);
  return `/chuong/${groupRootId(chapter)}${level > 1 ? `?cap=${level}` : ''}`;
}

export function ChapterIntroPage() {
  const found = useChapterParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { data: summary } = useApiData(api.summary, 'summary');
  // Đến từ "Chơi thôi!" sau khi học thẻ => mở sẵn bảng chọn trò chơi.
  const [choosing, setChoosing] = useState(() => Boolean((location.state as { chooseGame?: boolean } | null)?.chooseGame));
  useEffect(() => {
    if (found && !found.chapter.parentId) void AudioController.speak(found.ui.introVoice);
  }, [found?.chapter.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!found) return <Navigate to="/" replace />;
  const { chapter, ui } = found;
  // Trò chơi phụ / cấp cao không có trang riêng: chuyển về trang chương gốc đúng cấp.
  if (chapter.parentId) return <Navigate to={chapterPagePath(chapter)} replace />;
  const { Illustration } = ui;

  const bestScoreOf = (id: string) => summary?.chapters.find((c) => c.chapterId === id)?.bestScore ?? 0;
  const levels = getLevels(chapter.id);
  const current = levels.find((l) => l.level === Number(params.get('cap'))) ?? levels[0]!;
  const unlocked = current.games.every((g) => isChapterUnlocked(g, bestScoreOf));

  const games = current.games.flatMap((game) => {
    const gameUI = getChapterUI(game.id);
    return gameUI ? [{ game, ui: gameUI }] : [];
  });
  const learning = games.find((g) => g.ui.Learning);
  const startGame = (id: string) => {
    AudioController.sfx('tap');
    navigate(`/chuong/${id}/choi`);
  };
  const selectLevel = (level: ChapterLevel) => {
    AudioController.sfx('tap');
    setChoosing(false);
    setParams(level.level > 1 ? { cap: String(level.level) } : {}, { replace: true });
    if (!level.games.every((g) => isChapterUnlocked(g, bestScoreOf))) void AudioController.speak(VOICE_PHRASES.levelLocked);
  };

  return (
    <PageShell>
      <BackButton to={chapter.hubId ? `/chuong/${chapter.hubId}` : '/'} />
      <motion.div
        className="card mx-auto mt-4 flex max-w-2xl flex-col items-center gap-4 overflow-hidden pb-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex h-40 w-full items-center justify-center" style={{ backgroundColor: chapter.theme.soft }}>
          <Illustration />
        </div>
        <Mascot mood={unlocked ? 'happy' : 'thinking'} size={110} />
        <h1 className="px-4 text-4xl font-extrabold uppercase sm:text-5xl" style={{ color: chapter.theme.strong }}>
          {chapter.name}
        </h1>
        <p className="px-4 text-2xl font-semibold text-ink/70">{chapter.description}</p>

        {/* Chương "cửa vào" (hubOnly) không có bài: chỉ hiện các chủ đề bên dưới. */}
        {!chapter.hubOnly && (
          <>
        {levels.length > 1 && (
          <div className="flex w-full flex-wrap justify-center gap-2 px-6" role="tablist" aria-label="Chọn cấp độ">
            {levels.map((level) => {
              const open = level.games.every((g) => isChapterUnlocked(g, bestScoreOf));
              const selected = level.level === current.level;
              return (
                <button
                  key={level.level}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`Số ${level.label}${open ? '' : ' – đang khoá'}`}
                  onClick={() => selectLevel(level)}
                  className={`flex min-h-[64px] min-w-[96px] items-center justify-center gap-1 rounded-full px-4 text-2xl font-extrabold shadow-pop-sm transition-transform active:translate-y-0.5 ${
                    selected ? 'text-white' : 'bg-white text-ink'
                  } ${open ? '' : 'opacity-70'}`}
                  style={selected ? { backgroundColor: chapter.theme.strong } : undefined}
                  data-testid="level-tab"
                  data-level={level.level}
                  data-locked={!open}
                >
                  {!open && <Lock size={20} strokeWidth={3} />} {level.label}
                </button>
              );
            })}
          </div>
        )}

        {games.length === 1 && games[0]!.game.game && levels.length > 1 && (
          <p className="px-4 text-xl font-bold" style={{ color: chapter.theme.strong }} data-testid="level-name">
            {current.label}: {games[0]!.game.game.name}
          </p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {!unlocked ? (
            <LockedPanel key={`locked-${current.level}`} level={current} bestScoreOf={bestScoreOf} />
          ) : choosing ? (
            <motion.div
              key={`choose-${current.level}`}
              className="flex w-full flex-col gap-3 px-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              data-testid="game-picker"
            >
              <p className="text-2xl font-extrabold text-ink">Bé chọn trò chơi nào?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {games.map(({ game, ui: gameUI }) => (
                  <button
                    key={game.id}
                    type="button"
                    className="kid-btn flex-col gap-1 py-4 text-white"
                    style={{ backgroundColor: game.theme.primary }}
                    onClick={() => startGame(game.id)}
                    aria-label={`Chơi ${game.game?.name ?? game.name}: ${game.game?.hint ?? game.description}`}
                    data-testid="choose-game"
                    data-chapter={game.id}
                  >
                    <span className="flex items-center gap-2 text-2xl">
                      <gameUI.Icon size={32} strokeWidth={2.6} /> {game.game?.name ?? game.name}
                    </span>
                    <span className="text-lg font-bold opacity-90">{game.game?.hint ?? game.description}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mx-auto flex items-center gap-1 rounded-full px-4 py-2 text-lg font-bold text-ink/60"
                onClick={() => setChoosing(false)}
              >
                <ChevronLeft size={22} /> Quay lại
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`main-${current.level}`}
              className="flex w-full flex-col gap-3 px-6 sm:flex-row"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {learning?.ui.Learning && (
                <button
                  type="button"
                  className="kid-btn flex-1 bg-sunny-400 text-ink"
                  onClick={() => {
                    AudioController.sfx('tap');
                    navigate(`/chuong/${learning.game.id}/hoc`);
                  }}
                  data-testid="start-learning"
                >
                  <learning.ui.Learning.Icon size={32} strokeWidth={2.6} /> {learning.ui.Learning.label}
                </button>
              )}
              <button
                type="button"
                className="kid-btn flex-1 text-white"
                style={{ backgroundColor: chapter.theme.primary }}
                onClick={() => {
                  if (games.length > 1) {
                    AudioController.sfx('tap');
                    setChoosing(true);
                  } else startGame(games[0]!.game.id);
                }}
                data-testid="start-quiz"
              >
                <Gamepad2 size={32} strokeWidth={2.6} /> Chơi ngay
              </button>
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}
      </motion.div>

      {getHubChapters(chapter.id).length > 0 && <TopicShelf topics={getHubChapters(chapter.id)} summary={summary} title={chapter.hubOnly ? 'Bé chọn chủ đề nhé' : 'Hoặc chọn chủ đề'} />}
    </PageShell>
  );
}

/** Cấp đang khoá: nói rõ cần đạt bao nhiêu điểm ở trò nào, bé đang được bao nhiêu. */
function LockedPanel({ level, bestScoreOf }: { level: ChapterLevel; bestScoreOf: (id: string) => number }) {
  const required = unlockRequirements(level.games[0]!);
  const prevLabel = getLevels(groupRootId(level.games[0]!)).filter((l) => l.level < level.level).pop()?.label ?? '';
  return (
    <motion.div
      className="mx-6 flex flex-col items-center gap-3 rounded-4xl bg-ink/5 p-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      data-testid="level-locked"
    >
      <p className="flex items-center gap-2 text-2xl font-extrabold text-ink">
        <Lock size={28} strokeWidth={3} /> Cấp {level.label} đang khoá
      </p>
      <p className="text-xl font-semibold text-ink/70">
        Bé đạt {LEVEL_UNLOCK_MIN_SCORE} điểm ở {required.length > 1 ? 'cả hai trò' : 'trò'} của cấp {prevLabel} để mở nhé!
      </p>
      <ul className="flex w-full flex-col gap-2">
        {required.map((game) => {
          const best = bestScoreOf(game.id);
          const done = best >= LEVEL_UNLOCK_MIN_SCORE;
          return (
            <li key={game.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-xl font-bold shadow-pop-sm">
              <span>{game.game?.name ?? game.name}</span>
              <span className={`flex items-center gap-1 ${done ? 'text-mint-500' : 'text-ink/60'}`}>
                {done && <Check size={24} strokeWidth={3.5} />} {best}/{LEVEL_UNLOCK_MIN_SCORE} điểm
              </span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

export function LearningPage() {
  const found = useChapterParams();
  const navigate = useNavigate();
  if (!found || !found.ui.Learning) return <Navigate to="/" replace />;
  const { chapter, ui } = found;
  const View = ui.Learning!.View;
  const backTo = chapterPagePath(chapter);
  const levelGames = getLevels(groupRootId(chapter)).find((l) => l.level === chapterLevel(chapter))?.games ?? [chapter];
  return (
    <PageShell>
      <div className="mb-3 flex items-center gap-3">
        <BackButton to={backTo} />
        <h1 className="text-3xl font-extrabold" style={{ color: chapter.theme.strong }}>
          {ui.Learning!.label}
        </h1>
      </div>
      <View
        onFinished={() => {
          api.completeLearning(chapter.id).catch(() => undefined);
          if (levelGames.length > 1) navigate(backTo, { state: { chooseGame: true } });
          else navigate(`/chuong/${chapter.id}/choi`);
        }}
      />
    </PageShell>
  );
}
