/**
 * Cổng mã gia đình: máy lạ phải nhập mã do bố mẹ đặt mới vào được ứng dụng.
 * Đây chỉ là lớp giao diện – server từ chối mọi API khi chưa có mã (401 family_required).
 * Trang phụ huynh luôn vào được để bố mẹ đăng nhập bằng PIN khi quên mã.
 */
import { Home, KeyRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mascot } from '../../components/Mascot';
import { PageShell } from '../../components/ui';
import { api, FAMILY_REQUIRED_EVENT } from '../../services/api';
import { Keypad, PinDots } from '../parent/ParentGate';

type GateState = 'checking' | 'open' | 'locked';

export function FamilyGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  // Đổi key => dựng lại toàn bộ ứng dụng để tải lại dữ liệu sau khi mở khoá.
  const [generation, setGeneration] = useState(0);
  const { pathname } = useLocation();
  const onParentPage = pathname.startsWith('/phu-huynh');

  useEffect(() => {
    let alive = true;
    api
      .familyStatus()
      .then((s) => alive && setState(s.unlocked ? 'open' : 'locked'))
      // Mất mạng: cho vào chơi ngoại tuyến (kết quả không được lưu).
      .catch(() => alive && setState('open'));
    const onRequired = () => setState('locked');
    window.addEventListener(FAMILY_REQUIRED_EVENT, onRequired);
    return () => {
      alive = false;
      window.removeEventListener(FAMILY_REQUIRED_EVENT, onRequired);
    };
  }, [generation]);

  // Rời trang phụ huynh khi đang khoá: kiểm tra lại (phụ huynh đăng nhập PIN cũng được nhớ mã).
  useEffect(() => {
    if (state !== 'locked' || onParentPage) return;
    let alive = true;
    api
      .familyStatus()
      .then((s) => alive && s.unlocked && setGeneration((g) => g + 1))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onParentPage]);

  if (state === 'checking') return null;
  if (state === 'locked' && !onParentPage) {
    return (
      <FamilyUnlock
        onUnlocked={() => {
          setState('checking');
          setGeneration((g) => g + 1);
        }}
      />
    );
  }
  return (
    <div key={generation} className="contents">
      {children}
    </div>
  );
}

function FamilyUnlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (code.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.familyUnlock(code);
      onUnlocked();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa vào được, thử lại nhé!');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell className="flex items-center justify-center">
      <div className="card mx-auto mt-6 flex max-w-md flex-col items-center gap-4 p-6 text-center" data-testid="family-gate">
        <Mascot mood="happy" size={120} />
        <h1 className="flex items-center gap-2 text-3xl font-extrabold">
          <KeyRound className="text-grape-500" size={32} /> Mã gia đình
        </h1>
        <p className="text-lg font-semibold text-ink/70">Bố mẹ nhập mã gia đình để bé vào chơi nhé!</p>
        <PinDots length={code.length} max={Math.max(6, code.length)} />
        <Keypad value={code} onChange={setCode} max={8} />
        {error && (
          <p className="font-semibold text-bubblegum-500" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="kid-btn w-full max-w-xs bg-grape-500 text-xl text-white"
          disabled={code.length < 4 || busy}
          onClick={submit}
          data-testid="family-submit"
        >
          <Home size={28} /> Vào chơi
        </button>
        <p className="text-sm text-ink/60">
          Quên mã? Bố mẹ vào{' '}
          <Link to="/phu-huynh" className="font-bold text-grape-500 underline">
            Khu phụ huynh
          </Link>{' '}
          bằng mã PIN để đặt lại.
        </p>
      </div>
    </PageShell>
  );
}
