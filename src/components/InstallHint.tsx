/**
 * Gợi ý cài ứng dụng (PWA) lên màn hình chính.
 *  - iPhone / iPad: Safari không có nút cài tự động => hướng dẫn "Chia sẻ → Thêm vào MH chính".
 *  - Android / máy tính (Chrome, Edge): dùng sự kiện beforeinstallprompt => nút "Cài ứng dụng".
 * Không hiện khi đang mở như ứng dụng, hoặc khi bố mẹ đã bấm "Để sau" (nhớ trên máy này).
 */
import { Share, SquarePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readLocal, writeLocal } from '../utils/storage';

const DISMISS_KEY = 'bvht:install-hint-dismissed';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ báo là "Macintosh" nhưng có màn hình cảm ứng.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => readLocal<boolean>(DISMISS_KEY) === true);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios] = useState(() => typeof navigator !== 'undefined' && isIOS());
  const [standalone] = useState(() => typeof window !== 'undefined' && isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || standalone || (!ios && !prompt)) return null;

  const close = () => {
    writeLocal(DISMISS_KEY, true);
    setDismissed(true);
  };

  return (
    <div className="mt-4 flex items-start gap-3 rounded-3xl bg-white/80 p-4 shadow-pop-sm" role="note" data-testid="install-hint">
      <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="font-extrabold">Cài “Bé Học Toán” lên màn hình chính</p>
        {ios ? (
          <p className="text-ink/70">
            Bố mẹ bấm nút <Share size={18} className="inline align-text-bottom text-sky-500" aria-label="Chia sẻ" /> <b>Chia sẻ</b> của Safari, rồi chọn{' '}
            <SquarePlus size={18} className="inline align-text-bottom" aria-hidden /> <b>Thêm vào MH chính</b>. Bé mở như một ứng dụng, toàn màn hình.
          </p>
        ) : (
          <button
            type="button"
            className="self-start rounded-2xl bg-grape-500 px-4 py-2 font-bold text-white"
            onClick={async () => {
              await prompt!.prompt();
              const choice = await prompt!.userChoice;
              setPrompt(null);
              if (choice.outcome === 'accepted') close();
            }}
          >
            Cài ứng dụng
          </button>
        )}
      </div>
      <button type="button" className="rounded-full p-1 text-ink/40" onClick={close} aria-label="Để sau">
        <X size={22} />
      </button>
    </div>
  );
}
