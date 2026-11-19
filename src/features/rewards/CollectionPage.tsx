/**
 * Bộ sưu tập: kẹo, hộp quà (đủ 10 kẹo mở 1 hộp), album sticker.
 * Mọi phần thưởng đọc từ database – không tồn tại chỉ trong giao diện.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Lock, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { Mascot } from '../../components/Mascot';
import { BackButton, LoadingMascotDots, PageShell, ProgressBar } from '../../components/ui';
import { REWARD_CONFIG } from '../../config/rewards';
import { getSticker, stickerImage, STICKERS } from '../../data/stickers';
import { VOICE_PHRASES } from '../../data/voice';
import { useApiData } from '../../hooks/useApiData';
import { api, ApiClientError, type GiftResult } from '../../services/api';
import { newId } from '../../utils/storage';
import { AnimationController } from '../animation/AnimationController';
import { AudioController } from '../audio/AudioController';

type GiftStage = 'idle' | 'opening' | 'revealed';

export function CollectionPage() {
  const { data, loading, error, reload } = useApiData(api.rewards);
  const [stage, setStage] = useState<GiftStage>('idle');
  const [gift, setGift] = useState<GiftResult | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const pendingGiftId = useRef<string | null>(null);

  const openGift = async () => {
    if (stage !== 'idle') return; // chống bấm liên tục
    setGiftError(null);
    setStage('opening');
    AudioController.sfx('gift');
    void AudioController.speak(VOICE_PHRASES.giftReady);
    // Dùng lại cùng giftId nếu lần trước lỗi mạng => server không mở thêm hộp.
    pendingGiftId.current ??= newId();
    try {
      const [result] = await Promise.all([api.openGift(pendingGiftId.current), new Promise((r) => setTimeout(r, 1600))]);
      pendingGiftId.current = null;
      setGift(result);
      setStage('revealed');
      AnimationController.bigCelebration(1500);
      AudioController.sfx('candy');
      void AudioController.speak(VOICE_PHRASES.sticker);
      void reload();
    } catch (e) {
      if (e instanceof ApiClientError && e.status !== 0) pendingGiftId.current = null;
      setGiftError(e instanceof Error ? e.message : 'Chưa mở được hộp quà');
      setStage('idle');
    }
  };

  const owned = new Map((data?.stickers ?? []).map((s) => [s.code, s]));
  const candies = data?.totalCandies ?? 0;
  const progressInGift = candies % REWARD_CONFIG.candiesPerGift;

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-3">
        <BackButton to="/" />
        <h1 className="text-3xl font-extrabold sm:text-4xl">Bộ sưu tập của bé</h1>
      </div>

      {loading && !data && <LoadingMascotDots />}
      {error && !data && <p className="card p-4 text-center text-lg">Chưa tải được bộ sưu tập. Nhờ bố mẹ kiểm tra kết nối nhé!</p>}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="card flex flex-col items-center gap-3 p-5 text-center" aria-label="Kẹo">
              <h2 className="text-2xl font-extrabold">Hũ kẹo</h2>
              <div className="flex flex-wrap justify-center gap-1" aria-hidden>
                {Array.from({ length: Math.min(candies, 30) }, (_, i) => (
                  <motion.img
                    key={i}
                    src="/assets/rewards/candy.svg"
                    alt=""
                    className="h-10 w-10"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                  />
                ))}
                {candies === 0 && <img src="/assets/rewards/lollipop.svg" alt="" className="h-16 w-16 opacity-40" />}
              </div>
              <p className="text-4xl font-extrabold text-bubblegum-500" data-testid="candy-total">
                {candies} <span className="text-2xl text-ink/60">viên kẹo</span>
              </p>
              <p className="text-lg text-ink/60">Đạt 10/10 để nhận thêm kẹo nhé!</p>
            </section>

            <section className="card flex flex-col items-center gap-3 p-5 text-center" aria-label="Hộp quà">
              <h2 className="text-2xl font-extrabold">Hộp quà bất ngờ</h2>
              <motion.button
                type="button"
                disabled={data.giftsAvailable === 0 || stage !== 'idle'}
                onClick={openGift}
                aria-label={data.giftsAvailable > 0 ? 'Mở hộp quà' : 'Hộp quà đang khoá'}
                className="relative"
                animate={
                  stage === 'opening'
                    ? { rotate: [0, -12, 12, -12, 12, 0], scale: [1, 1.1, 1.2, 1.1, 1.3, 0] }
                    : data.giftsAvailable > 0
                      ? { y: [0, -10, 0] }
                      : {}
                }
                transition={stage === 'opening' ? { duration: 1.5 } : { duration: 1.2, repeat: Infinity }}
                data-testid="open-gift"
              >
                <img src="/assets/rewards/gift.svg" alt="" className={`h-32 w-32 ${data.giftsAvailable === 0 ? 'opacity-40 grayscale' : ''}`} />
                {data.giftsAvailable === 0 && (
                  <span className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink/60 shadow-pop-sm">
                    <Lock size={22} />
                  </span>
                )}
                {data.giftsAvailable > 1 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-bubblegum-500 px-3 text-2xl font-extrabold text-white">
                    x{data.giftsAvailable}
                  </span>
                )}
              </motion.button>
              {data.giftsAvailable > 0 ? (
                <button type="button" className="kid-btn bg-grape-400 text-white" onClick={openGift} disabled={stage !== 'idle'}>
                  <Gift size={30} /> Mở quà!
                </button>
              ) : (
                <>
                  <ProgressBar value={progressInGift} max={REWARD_CONFIG.candiesPerGift} color="#FF7BAC" label="Kẹo để mở quà" />
                  <p className="text-lg font-bold text-ink/70">Còn {data.candiesUntilNextGift} viên kẹo nữa là mở được quà!</p>
                </>
              )}
              {giftError && <p className="text-base text-ink/60">{giftError}</p>}
            </section>
          </div>

          <section className="card mt-4 p-5" aria-label="Album sticker">
            <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold">
              <Sparkles className="text-sunny-500" /> Album sticker ({owned.size}/{STICKERS.length})
            </h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
              {STICKERS.map((s) => {
                const have = owned.get(s.code);
                return (
                  <div
                    key={s.code}
                    className={`relative flex flex-col items-center gap-1 rounded-3xl p-2 text-center ${have ? 'bg-sunny-100' : 'bg-ink/5'}`}
                    data-testid={have ? 'sticker-owned' : 'sticker-locked'}
                  >
                    <img src={stickerImage(s.code)} alt="" className={`h-16 w-16 ${have ? '' : 'opacity-25 grayscale'}`} />
                    <span className={`text-sm font-bold leading-tight ${have ? '' : 'text-ink/30'}`}>{have ? s.name : '???'}</span>
                    {have && have.quantity > 1 && (
                      <span className="absolute right-1 top-1 rounded-full bg-white px-2 text-sm font-extrabold">x{have.quantity}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <AnimatePresence>
        {stage === 'revealed' && gift && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-grape-300/90 p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="gift-reveal"
          >
            <motion.img
              src={stickerImage(gift.stickerCode)}
              alt=""
              className="h-48 w-48 drop-shadow-2xl"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 12 }}
            />
            <h2 className="text-4xl font-extrabold text-white drop-shadow">{getSticker(gift.stickerCode)?.name}</h2>
            <p className="text-2xl font-bold text-white">{gift.isNewSticker ? 'Sticker mới cho bộ sưu tập!' : 'Thêm một sticker nữa!'}</p>
            <Mascot mood="cheer" size={110} />
            <button
              type="button"
              className="kid-btn bg-white text-ink"
              onClick={() => {
                AnimationController.stop();
                setStage('idle');
                setGift(null);
              }}
            >
              Tuyệt quá!
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
