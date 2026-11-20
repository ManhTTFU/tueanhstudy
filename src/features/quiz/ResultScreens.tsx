import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Gift, Home, Percent, RotateCcw, Sparkles, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Mascot } from '../../components/Mascot';
import { Stars } from '../../components/ui';
import { getSticker, stickerImage } from '../../data/stickers';
import { PERFECT_MESSAGE } from '../../engine/messages';
import { formatDateTime } from '../../utils/storage';
import { AudioController } from '../audio/AudioController';
import type { QuizResultView } from './useQuiz';

function starsFor(score: number) {
  return score >= 10 ? 3 : score >= 7 ? 2 : 1; // luôn có ít nhất 1 sao – không tạo cảm giác thất bại
}

/** Màn hình nhận thưởng khi đạt 10/10 (toàn màn hình). */
/** `coinsOnly`: nhóm 5–9 tuổi – thưởng bằng xu, không có kẹo / hộp quà / sticker. */
export function RewardCelebration({ result, onContinue, coinsOnly = false }: { result: QuizResultView; onContinue: () => void; coinsOnly?: boolean }) {
  const stickers = result.rewards.filter((r) => r.rewardType === 'sticker');
  const coins = result.coinsEarned ?? 0;
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-sunny-300 via-bubblegum-300 to-grape-300 p-4 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="reward-celebration"
    >
      <motion.h1
        className="max-w-3xl text-4xl font-extrabold leading-tight text-white drop-shadow-[0_4px_0_rgba(59,47,92,0.35)] sm:text-6xl"
        initial={{ scale: 0.4, rotate: -6 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      >
        {PERFECT_MESSAGE}
      </motion.h1>

      <div className="relative my-4 flex items-end justify-center gap-2">
        <Mascot mood="cheer" size={150} />
        <motion.div
          className="relative"
          initial={{ y: -300, rotate: -40 }}
          animate={{ y: 0, rotate: [0, -10, 10, 0] }}
          transition={{ type: 'spring', stiffness: 120, damping: 9, delay: 0.3 }}
        >
          {coinsOnly ? (
            <span className="block text-[8rem] leading-none drop-shadow-xl" aria-label="Xu">
              🪙
            </span>
          ) : (
            <img src="/assets/rewards/candy.svg" alt="Viên kẹo" className="h-36 w-36 drop-shadow-xl sm:h-44 sm:w-44" />
          )}
          {(coinsOnly ? coins : result.candiesEarned) > 0 && (
            <span className="absolute -right-2 top-0 rounded-full bg-white px-4 py-1 text-3xl font-extrabold text-bubblegum-500 shadow-pop-sm">
              +{coinsOnly ? coins : result.candiesEarned}
            </span>
          )}
        </motion.div>
      </div>

      {coinsOnly && coins > 0 ? (
        <p className="text-2xl font-bold text-white sm:text-3xl">Con nhận được {coins} xu!</p>
      ) : result.candiesEarned > 0 ? (
        <p className="text-2xl font-bold text-white sm:text-3xl">Bé nhận được {result.candiesEarned} viên kẹo!</p>
      ) : !result.saved ? (
        <p className="rounded-2xl bg-white/70 px-4 py-2 text-lg font-bold text-ink/70">Chưa lưu được phần thưởng – nhờ bố mẹ kiểm tra kết nối nhé.</p>
      ) : null}

      {stickers.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {stickers.map((s) => (
            <motion.div
              key={s.dedupeKey}
              className="flex flex-col items-center rounded-3xl bg-white/90 p-3 shadow-pop"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: 'spring' }}
            >
              <img src={stickerImage(s.rewardCode)} alt="" className="h-20 w-20" />
              <span className="text-lg font-bold">{getSticker(s.rewardCode)?.name ?? 'Sticker mới'}</span>
            </motion.div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="kid-btn mt-6 bg-white text-ink"
        onClick={() => {
          AudioController.sfx('tap');
          onContinue();
        }}
        data-testid="celebration-continue"
      >
        <Sparkles size={30} /> Xem kết quả
      </button>
    </motion.div>
  );
}

/** Màn hình hoàn thành bài. */
export function ResultScreen({
  result,
  onReplay,
  onRetrySave,
  coinsOnly = false,
}: {
  result: QuizResultView;
  onReplay: () => void;
  onRetrySave: () => void;
  /** Nhóm 5–9 tuổi: không có hộp quà (thưởng bằng xu). */
  coinsOnly?: boolean;
}) {
  const navigate = useNavigate();
  const stickers = result.rewards.filter((r) => r.rewardType === 'sticker');
  return (
    <motion.div
      className="card mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-5 text-center sm:p-8"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      data-testid="result-screen"
    >
      <Mascot mood={result.score >= 8 ? 'cheer' : 'happy'} size={130} />
      <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{result.encouragement}</h1>
      <Stars count={starsFor(result.score)} size={48} />

      <div className="text-7xl font-extrabold text-bubblegum-500" data-testid="result-score">
        {result.score}
        <span className="text-4xl text-ink/40">/10</span>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 text-left sm:grid-cols-4">
        <Stat icon={<CheckCircle2 className="text-mint-500" />} label="Câu đúng" value={result.correctAnswers} testId="result-correct" />
        <Stat icon={<Target className="text-sky-500" />} label="Cần luyện thêm" value={result.incorrectAnswers} testId="result-incorrect" />
        <Stat icon={<Percent className="text-grape-500" />} label="Tỷ lệ đúng" value={`${result.percent}%`} />
        <Stat icon={<Clock className="text-peach-500" />} label="Hoàn thành" value={formatDateTime(result.completedAt)} small />
      </div>

      {(result.coinsEarned ?? 0) > 0 && (
        <p className="rounded-3xl bg-sunny-100 px-4 py-2 text-xl font-extrabold" data-testid="result-coins">
          🪙 +{result.coinsEarned} xu
        </p>
      )}

      {(result.candiesEarned > 0 || stickers.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-3xl bg-sunny-100 px-4 py-3">
          {result.candiesEarned > 0 && (
            <span className="flex items-center gap-2 text-xl font-bold">
              <img src="/assets/rewards/candy.svg" alt="" className="h-10 w-10" /> +{result.candiesEarned} kẹo
            </span>
          )}
          {stickers.map((s) => (
            <span key={s.dedupeKey} className="flex items-center gap-2 text-xl font-bold">
              <img src={stickerImage(s.rewardCode)} alt="" className="h-10 w-10" /> {getSticker(s.rewardCode)?.name}
            </span>
          ))}
        </div>
      )}

      {!coinsOnly && (result.giftsAvailable ?? 0) > 0 && (
        <button type="button" className="kid-btn bg-grape-400 text-white" onClick={() => navigate('/bo-suu-tap')}>
          <Gift size={30} /> Mở hộp quà!
        </button>
      )}

      {!result.saved && (
        <div className="rounded-2xl bg-peach-100 px-4 py-2 text-base text-ink/80">
          Chưa lưu được kết quả lên máy chủ.{' '}
          {result.sessionId && (
            <button type="button" className="font-bold underline" onClick={onRetrySave}>
              Thử lưu lại
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
        <button type="button" className="kid-btn flex-1 bg-sunny-400 text-ink" onClick={onReplay} data-testid="replay">
          <RotateCcw size={30} strokeWidth={3} /> Chơi lại
        </button>
        <button type="button" className="kid-btn flex-1 bg-sky-400 text-white" onClick={() => navigate('/')} data-testid="go-home">
          <Home size={30} strokeWidth={3} /> Về trang chủ
        </button>
      </div>
    </motion.div>
  );
}

function Stat({ icon, label, value, small, testId }: { icon: React.ReactNode; label: string; value: string | number; small?: boolean; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-cream p-3">
      <span className="flex items-center gap-1 text-sm font-bold text-ink/60">
        {icon} {label}
      </span>
      <span className={`${small ? 'text-base' : 'text-3xl'} font-extrabold`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
