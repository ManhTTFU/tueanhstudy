/**
 * Đổi quà thật (nhóm 5–9 tuổi): bé dùng xu kiếm được để đổi các món quà bố mẹ đặt
 * trong Góc phụ huynh. Mỗi lần đổi có mã riêng (UUID) => bấm lặp không bị trừ xu hai lần.
 */
import { Gift, PackageCheck, Hourglass } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mascot } from '../../components/Mascot';
import { BackButton, PageShell } from '../../components/ui';
import { useApiData } from '../../hooks/useApiData';
import { api } from '../../services/api';
import { formatDateTime, newId } from '../../utils/storage';
import { AnimationController } from '../animation/AnimationController';
import { AudioController } from '../audio/AudioController';

export function ShopPage() {
  const { data: shop, error, setData } = useApiData(api.shop);
  const [confirm, setConfirm] = useState<{ id: string; name: string; cost: number; redemptionId: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const balance = shop?.coins.balance ?? 0;

  const redeem = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      const next = await api.redeem(confirm.id, confirm.redemptionId);
      setData(next);
      AudioController.sfx('celebrate');
      AnimationController.bigCelebration();
      setMsg(`Con đã đổi "${confirm.name}". Nhắc bố mẹ trao quà nhé!`);
      setConfirm(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Chưa đổi được quà');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-3">
        <BackButton to="/" />
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Gift className="text-bubblegum-500" /> Đổi quà
        </h1>
      </div>

      <div className="card mb-4 flex items-center justify-between gap-3 p-4">
        <span className="text-xl font-bold text-ink/70">Xu của con</span>
        <span className="text-4xl font-extrabold" data-testid="shop-balance">
          🪙 {balance}
        </span>
      </div>

      {error && <p className="mb-3 text-center text-ink/60">Chưa kết nối được máy chủ.</p>}
      {msg && (
        <p className="mb-3 rounded-2xl bg-mint-100 px-4 py-3 text-center text-lg font-bold" role="status" data-testid="shop-msg">
          {msg}
        </p>
      )}

      {shop && shop.rewards.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-6 text-center" data-testid="shop-empty">
          <Mascot mood="thinking" size={110} />
          <p className="text-xl font-bold">Bố mẹ chưa đặt quà nào.</p>
          <p className="text-ink/70">
            Nhờ bố mẹ vào{' '}
            <Link to="/phu-huynh" className="font-bold text-grape-500 underline">
              Góc phụ huynh
            </Link>{' '}
            để thêm quà nhé!
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {shop?.rewards.map((r) => {
          const enough = balance >= r.cost;
          return (
            <div key={r.id} className="card flex flex-col gap-3 p-4" data-testid="shop-item">
              <p className="text-2xl font-extrabold">🎁 {r.name}</p>
              <p className="text-xl font-bold text-ink/70">🪙 {r.cost} xu</p>
              <button
                type="button"
                className={`kid-btn w-full ${enough ? 'bg-bubblegum-400 text-white' : 'bg-ink/10 text-ink/70'}`}
                disabled={!enough}
                onClick={() => {
                  setMsg(null);
                  setConfirm({ ...r, redemptionId: newId() });
                }}
                data-testid="shop-redeem"
              >
                {enough ? 'Đổi quà' : `Còn thiếu ${r.cost - balance} xu`}
              </button>
            </div>
          );
        })}
      </div>

      {shop && shop.redemptions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xl font-extrabold">Quà con đã đổi</h2>
          <ul className="flex flex-col gap-2">
            {shop.redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-pop-sm">
                <span className="flex flex-col">
                  <span className="font-bold">{r.name}</span>
                  <span className="text-sm text-ink/50">
                    {formatDateTime(r.redeemedAt)} · {r.cost} xu
                  </span>
                </span>
                {r.deliveredAt ? (
                  <span className="flex items-center gap-1 font-bold text-mint-500">
                    <PackageCheck size={20} /> Đã nhận
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-bold text-peach-500">
                    <Hourglass size={20} /> Chờ bố mẹ trao
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="card flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
            <p className="text-2xl font-extrabold">Đổi “{confirm.name}”?</p>
            <p className="text-lg">
              Con sẽ dùng <b>{confirm.cost} xu</b>, còn lại {balance - confirm.cost} xu.
            </p>
            <div className="flex w-full gap-3">
              <button type="button" className="kid-btn flex-1 bg-ink/10 text-ink" onClick={() => setConfirm(null)}>
                Để sau
              </button>
              <button type="button" className="kid-btn flex-1 bg-bubblegum-400 text-white" disabled={busy} onClick={() => void redeem()} data-testid="shop-confirm">
                Đổi luôn
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
