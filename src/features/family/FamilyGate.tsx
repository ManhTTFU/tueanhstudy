/**
 * Cổng gia đình: máy chưa đăng nhập phải chọn "Vào gia đình" (tên + mã gia đình,
 * hoặc tên + PIN phụ huynh khi quên mã) hoặc "Tạo gia đình mới" (cần mã mời).
 * Đăng nhập 1 lần, máy được nhớ 1 năm – bé mở app là chơi ngay.
 * Đây chỉ là lớp giao diện – server từ chối mọi API khi chưa đăng nhập (401 family_required).
 */
import { Home, KeyRound, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Mascot } from '../../components/Mascot';
import { PageShell } from '../../components/ui';
import { api, FAMILY_REQUIRED_EVENT, type RegistrationInfo } from '../../services/api';
import { clearDataCache, forgetFamilyOnDevice, rememberFamilyLogin, wasFamilyLoggedIn } from '../../utils/storage';

type GateState = { kind: 'checking' } | { kind: 'open' } | { kind: 'login'; registration: RegistrationInfo };

export function FamilyGate({ children }: { children: ReactNode }) {
  // Máy đã đăng nhập ở lần trước => mở app ngay, không chờ máy chủ; kiểm tra lại ở nền.
  // Nếu phiên đã hết hạn, mọi API trả 401 family_required => quay về màn đăng nhập.
  const [state, setState] = useState<GateState>(() => (wasFamilyLoggedIn() ? { kind: 'open' } : { kind: 'checking' }));
  // Đổi key => dựng lại toàn bộ ứng dụng để tải lại dữ liệu của gia đình vừa đăng nhập.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .familyStatus()
        .then((s) => {
          if (!alive) return;
          if (s.loggedIn) {
            rememberFamilyLogin();
            setState((prev) => (prev.kind === 'open' ? prev : { kind: 'open' }));
          } else {
            forgetFamilyOnDevice();
            setState({ kind: 'login', registration: s.registration });
          }
        })
        // Mất mạng: cho vào chơi ngoại tuyến (kết quả không được lưu).
        .catch(() => alive && setState((prev) => (prev.kind === 'open' ? prev : { kind: 'open' })));
    void check();
    window.addEventListener(FAMILY_REQUIRED_EVENT, check);
    return () => {
      alive = false;
      window.removeEventListener(FAMILY_REQUIRED_EVENT, check);
    };
  }, [generation]);

  if (state.kind === 'checking') return <GateSplash />;
  if (state.kind === 'login') {
    return (
      <FamilyLogin
        registration={state.registration}
        onDone={() => {
          // Có thể là gia đình khác => bỏ số liệu đệm của gia đình cũ.
          clearDataCache();
          rememberFamilyLogin();
          setState({ kind: 'checking' });
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

/** Màn chờ (chỉ khi máy chưa từng đăng nhập) – thay cho màn hình trắng. */
function GateSplash() {
  return (
    <PageShell>
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
        <Mascot mood="happy" size={140} />
        <p className="text-2xl font-extrabold text-ink/60">Đang tải…</p>
      </div>
    </PageShell>
  );
}

type Mode = 'code' | 'pin' | 'register';

function FamilyLogin({ registration, onDone }: { registration: RegistrationInfo; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('code');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await api.familyLogin(mode === 'pin' ? { name, pin: secret } : { name, code: secret });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa vào được, thử lại nhé!');
      setSecret('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell className="flex items-center justify-center">
      <div className="card mx-auto mt-6 flex w-full max-w-md flex-col items-center gap-4 p-6 text-center" data-testid="family-gate">
        <Mascot mood="happy" size={110} />
        {mode === 'register' ? (
          <RegisterForm registration={registration} onDone={onDone} onCancel={() => setMode('code')} />
        ) : (
          <>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold">
              <Users className="text-grape-500" size={32} /> Vào gia đình
            </h1>
            <p className="font-semibold text-ink/70">Bố mẹ đăng nhập một lần, lần sau bé mở là chơi ngay!</p>
            <form className="flex w-full flex-col gap-3 text-left" onSubmit={submit}>
              <label className="flex flex-col gap-1 font-semibold">
                Tên gia đình
                <input
                  className="parent-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nhà Tuệ Anh"
                  autoComplete="username"
                  maxLength={40}
                  data-testid="family-name"
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                {mode === 'pin' ? 'Mã PIN phụ huynh' : 'Mã gia đình'}
                <input
                  className="parent-input"
                  type="password"
                  inputMode="numeric"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value.replace(/\D/g, ''))}
                  maxLength={mode === 'pin' ? 6 : 8}
                  autoComplete="current-password"
                  data-testid="family-secret"
                />
              </label>
              {error && (
                <p className="font-semibold text-bubblegum-500" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="kid-btn w-full bg-grape-500 text-xl text-white"
                disabled={busy || name.trim().length < 1 || secret.length < 4}
                data-testid="family-submit"
              >
                <Home size={28} /> Vào chơi
              </button>
            </form>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-bold text-grape-500 underline"
              onClick={() => {
                setMode(mode === 'pin' ? 'code' : 'pin');
                setSecret('');
                setError(null);
              }}
            >
              {mode === 'pin' ? (
                <>
                  <KeyRound size={16} /> Đăng nhập bằng mã gia đình
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> Quên mã gia đình? Đăng nhập bằng PIN phụ huynh
                </>
              )}
            </button>
            <div className="w-full border-t border-ink/10 pt-3">
              {registration.open ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sunny-100 px-4 py-3 font-bold"
                  onClick={() => setMode('register')}
                  data-testid="family-register-open"
                >
                  <Sparkles size={20} /> Tạo gia đình mới
                </button>
              ) : (
                <p className="text-sm text-ink/50">
                  {registration.full ? 'Hệ thống đã đủ số gia đình.' : 'Muốn tạo gia đình mới? Hãy xin mã mời từ người quản lý.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function RegisterForm({
  registration,
  onDone,
  onCancel,
}: {
  registration: RegistrationInfo;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeAgain, setCodeAgain] = useState('');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Tên gia đình cần ít nhất 2 ký tự.');
    if (!/^\d{4,8}$/.test(code)) return setError('Mã gia đình gồm 4–8 chữ số.');
    if (code !== codeAgain) return setError('Hai lần nhập mã gia đình không khớp.');
    if (!/^\d{4,6}$/.test(pin)) return setError('Mã PIN phụ huynh gồm 4–6 chữ số.');
    if (pin !== pinAgain) return setError('Hai lần nhập mã PIN không khớp.');
    if (pin === code) return setError('Mã PIN phụ huynh nên khác mã gia đình.');
    setBusy(true);
    try {
      await api.familyRegister({ name, code, pin, ...(registration.inviteRequired ? { invite } : {}) });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được gia đình');
    } finally {
      setBusy(false);
    }
  };

  const digits = (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(e.target.value.replace(/\D/g, '').slice(0, max));

  return (
    <>
      <h1 className="flex items-center gap-2 text-3xl font-extrabold">
        <Sparkles className="text-sunny-500" size={30} /> Tạo gia đình mới
      </h1>
      <form className="flex w-full flex-col gap-3 text-left" onSubmit={submit}>
        <label className="flex flex-col gap-1 font-semibold">
          Tên gia đình
          <input className="parent-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nhà Bin" maxLength={40} data-testid="register-name" />
        </label>
        <p className="text-sm text-ink/60">
          <b>Mã gia đình</b> (4–8 số): dùng để đăng nhập trên mỗi máy của bé. <b>PIN phụ huynh</b> (4–6 số): để vào khu phụ huynh.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input className="parent-input" type="password" inputMode="numeric" placeholder="Mã gia đình" value={code} onChange={digits(setCode, 8)} autoComplete="new-password" data-testid="register-code" />
          <input className="parent-input" type="password" inputMode="numeric" placeholder="Nhập lại mã" value={codeAgain} onChange={digits(setCodeAgain, 8)} autoComplete="new-password" data-testid="register-code-again" />
          <input className="parent-input" type="password" inputMode="numeric" placeholder="PIN phụ huynh" value={pin} onChange={digits(setPin, 6)} autoComplete="new-password" data-testid="register-pin" />
          <input className="parent-input" type="password" inputMode="numeric" placeholder="Nhập lại PIN" value={pinAgain} onChange={digits(setPinAgain, 6)} autoComplete="new-password" data-testid="register-pin-again" />
        </div>
        {registration.inviteRequired && (
          <label className="flex flex-col gap-1 font-semibold">
            Mã mời
            <input className="parent-input" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Xin từ người quản lý" autoComplete="off" data-testid="register-invite" />
          </label>
        )}
        {error && (
          <p className="font-semibold text-bubblegum-500" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="kid-btn w-full bg-grape-500 text-xl text-white" disabled={busy} data-testid="register-submit">
          Tạo gia đình
        </button>
        <button type="button" className="text-sm font-bold text-ink/60 underline" onClick={onCancel}>
          Quay lại đăng nhập
        </button>
      </form>
    </>
  );
}
