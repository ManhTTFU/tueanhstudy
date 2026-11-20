/**
 * Hướng dẫn cài ứng dụng (PWA) lên màn hình chính iPhone / iPad – luôn hiện ở trang chủ
 * trên mọi thiết bị (để bố mẹ xem trên máy tính cũng biết cách cài cho máy của bé).
 * Trình duyệt hỗ trợ cài tự động (Chrome, Edge – sự kiện beforeinstallprompt) có thêm nút "Cài ứng dụng".
 * Chỉ ẩn khi đang mở như ứng dụng đã cài.
 */
import { Share, SquarePlus } from 'lucide-react';
import { useEffect, useState } from 'react';

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

export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [standalone] = useState(() => typeof window !== 'undefined' && isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (standalone) return null;

  return (
    <div className="mt-4 flex items-start gap-3 rounded-3xl bg-white/80 p-4 shadow-pop-sm" role="note" data-testid="install-hint">
      <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="font-extrabold">Cài “Bé Học Toán” lên màn hình chính iPhone/iPad</p>
        <p className="text-ink/70">
          Mở trang này bằng <b>Safari</b>, bấm nút <Share size={18} className="inline align-text-bottom text-sky-500" aria-label="Chia sẻ" /> <b>Chia sẻ</b>, rồi chọn{' '}
          <SquarePlus size={18} className="inline align-text-bottom" aria-hidden /> <b>Thêm vào MH chính</b>. Bé mở như một ứng dụng, toàn màn hình.
        </p>
        {prompt && (
          <button
            type="button"
            className="self-start rounded-2xl bg-grape-500 px-4 py-2 font-bold text-white"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
          >
            Cài ứng dụng trên máy này
          </button>
        )}
      </div>
    </div>
  );
}
