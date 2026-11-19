/**
 * Cổng phụ huynh: thiết lập PIN lần đầu (kèm câu hỏi dành cho người lớn) hoặc nhập PIN.
 * Lưu ý: đây chỉ là lớp giao diện – mọi API nhạy cảm đều được kiểm tra tại backend.
 */
import { Delete, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../services/api';

function Keypad({ value, onChange, max = 6 }: { value: string; onChange: (v: string) => void; max?: number }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-3">
      {keys.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            className="flex h-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold shadow-pop-sm active:translate-y-0.5"
            onClick={() => onChange(k === 'del' ? value.slice(0, -1) : value.length < max ? value + k : value)}
            aria-label={k === 'del' ? 'Xoá' : k}
          >
            {k === 'del' ? <Delete /> : k}
          </button>
        ),
      )}
    </div>
  );
}

function PinDots({ length, max = 6 }: { length: number; max?: number }) {
  return (
    <div className="flex gap-3" aria-label={`Đã nhập ${length} chữ số`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-4 w-4 rounded-full ${i < length ? 'bg-grape-500' : 'bg-ink/15'}`} />
      ))}
    </div>
  );
}

export function ParentGate({ pinConfigured, onAuthenticated }: { pinConfigured: boolean; onAuthenticated: () => void }) {
  return pinConfigured ? <PinLogin onAuthenticated={onAuthenticated} /> : <PinSetup onAuthenticated={onAuthenticated} />;
}

function PinLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.parentLogin(pin);
      onAuthenticated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đăng nhập được');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
      <ShieldCheck size={48} className="text-grape-500" />
      <h1 className="text-2xl font-extrabold">Khu vực phụ huynh</h1>
      <p className="text-ink/70">Nhập mã PIN để tiếp tục</p>
      <PinDots length={pin.length} />
      <Keypad value={pin} onChange={setPin} />
      {error && <p className="font-semibold text-bubblegum-500" role="alert">{error}</p>}
      <button type="button" className="kid-btn w-full max-w-xs bg-grape-500 text-xl text-white" disabled={pin.length < 4 || busy} onClick={submit}>
        Xác nhận
      </button>
    </div>
  );
}

function PinSetup({ onAuthenticated }: { onAuthenticated: () => void }) {
  const challenge = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 4);
    const b = 6 + Math.floor(Math.random() * 4);
    return { a, b, answer: a * b };
  }, []);
  const [answer, setAnswer] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (Number(answer) !== challenge.answer) return setError('Câu trả lời phép tính chưa đúng.');
    if (!/^\d{4,6}$/.test(pin)) return setError('Mã PIN gồm 4–6 chữ số.');
    if (pin !== confirm) return setError('Hai lần nhập mã PIN không khớp.');
    setBusy(true);
    try {
      await api.parentSetup(pin);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thiết lập được mã PIN');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <ShieldCheck size={48} className="text-grape-500" />
        <h1 className="text-2xl font-extrabold">Thiết lập khu vực phụ huynh</h1>
        <p className="text-ink/70">Tạo mã PIN để bảo vệ lịch sử học tập và các thao tác xoá / nhập dữ liệu.</p>
      </div>
      <label className="flex flex-col gap-1 font-semibold">
        Dành cho người lớn: {challenge.a} × {challenge.b} = ?
        <input className="parent-input" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Mã PIN mới (4–6 chữ số)
        <input className="parent-input" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoComplete="new-password" />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Nhập lại mã PIN
        <input className="parent-input" type="password" inputMode="numeric" maxLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} autoComplete="new-password" />
      </label>
      {error && <p className="font-semibold text-bubblegum-500" role="alert">{error}</p>}
      <button type="submit" className="kid-btn bg-grape-500 text-xl text-white" disabled={busy}>
        Lưu mã PIN
      </button>
    </form>
  );
}
