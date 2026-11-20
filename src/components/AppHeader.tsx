import { Lock, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../app/SettingsContext';
import { VOICE_PHRASES } from '../data/voice';
import { AudioController } from '../features/audio/AudioController';
import { Mascot } from './Mascot';
import { HoldButton, ProgressBar } from './ui';

/** `coins` có giá trị (nhóm 5–9 tuổi) => hiện xu thay cho kẹo. */
export function AppHeader({ progress, candies, coins }: { progress: number; candies: number; coins?: number | undefined }) {
  const { soundEnabled, setSoundEnabled } = useSettings();
  const navigate = useNavigate();
  return (
    <header className="card flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-5 sm:px-6">
      <button
        type="button"
        className="flex items-center gap-2 text-left sm:gap-3"
        onClick={() => void AudioController.speak(VOICE_PHRASES.welcome)}
        aria-label="Bạn Mochi chào bé"
      >
        <Mascot mood="happy" size={72} />
        <div>
          <h1 className="text-2xl font-extrabold leading-none tracking-wide sm:text-4xl">
            <span className="text-bubblegum-500">BÉ VUI</span> <span className="text-sky-500">HỌC TOÁN</span>
          </h1>
          <p className="text-base font-bold text-ink/60 sm:text-lg">Học mà chơi – Chơi mà học</p>
        </div>
      </button>

      <div className="order-last flex w-full flex-1 items-center gap-3 sm:order-none sm:w-auto">
        <span className="text-sm font-bold text-ink/60">Tiến độ</span>
        <ProgressBar value={progress} label="Tiến độ học tập" color="#4FD08F" />
        <span className="w-12 text-right text-lg font-extrabold">{progress}%</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {coins !== undefined ? (
          <span className="flex h-16 items-center gap-1 rounded-3xl bg-sunny-100 px-3 text-2xl font-extrabold" aria-label={`${coins} xu`} data-testid="header-coins">
            <span className="text-3xl" aria-hidden>
              🪙
            </span>
            {coins}
          </span>
        ) : (
          <span className="flex h-16 items-center gap-1 rounded-3xl bg-sunny-100 px-3 text-2xl font-extrabold" aria-label={`${candies} viên kẹo`}>
            <img src="/assets/rewards/candy.svg" alt="" className="h-10 w-10" />
            {candies}
          </span>
        )}
        <button
          type="button"
          className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 text-sky-500"
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? <Volume2 size={32} strokeWidth={2.6} /> : <VolumeX size={32} strokeWidth={2.6} />}
        </button>
        {/* Lối vào khu vực phụ huynh: nhỏ, mờ, phải GIỮ 1.5 giây */}
        <HoldButton
          label="Khu vực phụ huynh (giữ để mở)"
          onHold={() => navigate('/phu-huynh')}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink/25"
        >
          <Lock size={20} />
        </HoldButton>
      </div>
    </header>
  );
}
