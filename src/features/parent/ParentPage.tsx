/**
 * Khu vực phụ huynh: thống kê, lịch sử (phân trang), cài đặt, quản lý dữ liệu.
 * Truy cập trực tiếp bằng URL vẫn phải qua cổng PIN; API kiểm tra quyền tại backend.
 */
import { BarChart3, ChevronLeft, ChevronRight, Database, Download, Gift, History, LogOut, Settings, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '../../app/SettingsContext';
import { getEnabledChapters } from '../../chapters/registry';
import { BackButton, LoadingMascotDots, PageShell } from '../../components/ui';
import { getSticker, stickerImage } from '../../data/stickers';
import { api, ApiClientError, type HistoryPage, type ParentStats, type SessionDetail, type ShopView, type StickerCount } from '../../services/api';
import { formatDateTime } from '../../utils/storage';
import { ParentGate } from './ParentGate';

type Tab = 'stats' | 'history' | 'settings' | 'data' | 'gifts';

export function ParentPage() {
  const [session, setSession] = useState<{ pinConfigured: boolean; authenticated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      setSession(await api.parentSession());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không kết nối được máy chủ');
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const onUnauthorized = useCallback(() => setSession((s) => (s ? { ...s, authenticated: false } : s)), []);

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-3">
        <BackButton to="/" />
        <h1 className="text-2xl font-extrabold sm:text-3xl">Phụ huynh</h1>
      </div>
      {error && <p className="card p-4 text-center">{error}</p>}
      {!session && !error && <LoadingMascotDots />}
      {session && !session.authenticated && (
        <ParentGate pinConfigured={session.pinConfigured} onAuthenticated={() => setSession({ pinConfigured: true, authenticated: true })} />
      )}
      {session?.authenticated && <ParentDashboard onUnauthorized={onUnauthorized} />}
    </PageShell>
  );
}

function ParentDashboard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [tab, setTab] = useState<Tab>('stats');
  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'stats', label: 'Thống kê', icon: <BarChart3 size={20} /> },
    { id: 'history', label: 'Lịch sử', icon: <History size={20} /> },
    { id: 'gifts', label: 'Đổi quà', icon: <Gift size={20} /> },
    { id: 'settings', label: 'Cài đặt', icon: <Settings size={20} /> },
    { id: 'data', label: 'Dữ liệu', icon: <Database size={20} /> },
  ];
  /** Bọc lời gọi API: hết phiên => quay về cổng PIN. */
  const guard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 401) onUnauthorized();
        throw e;
      }
    },
    [onUnauthorized],
  );
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex min-h-[48px] items-center gap-2 rounded-2xl px-4 font-bold ${tab === t.id ? 'bg-grape-500 text-white' : 'bg-white text-ink/70 shadow-pop-sm'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto flex min-h-[48px] items-center gap-2 rounded-2xl bg-white px-4 font-bold text-ink/70 shadow-pop-sm"
          onClick={() => api.parentLogout().finally(onUnauthorized)}
        >
          <LogOut size={20} /> Thoát
        </button>
      </nav>
      {tab === 'stats' && <StatsTab guard={guard} />}
      {tab === 'history' && <HistoryTab guard={guard} />}
      {tab === 'gifts' && <GiftsTab guard={guard} />}
      {tab === 'settings' && <SettingsTab guard={guard} />}
      {tab === 'data' && <DataTab guard={guard} />}
    </div>
  );
}

type Guard = <T>(fn: () => Promise<T>) => Promise<T>;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function StatsTab({ guard }: { guard: Guard }) {
  const [stats, setStats] = useState<ParentStats | null>(null);
  const [stickers, setStickers] = useState<StickerCount[]>([]);
  useEffect(() => {
    guard(api.parentStats).then(setStats).catch(() => undefined);
    api.rewards().then((r) => setStickers(r.stickers)).catch(() => undefined);
  }, [guard]);
  if (!stats) return <LoadingMascotDots />;
  const t = stats.totals;
  const tiles = [
    ['Bài đã hoàn thành', t.totalCompletedQuizzes],
    ['Câu đúng', t.totalCorrectAnswers],
    ['Câu sai', t.totalIncorrectAnswers],
    ['Tỷ lệ đúng', `${t.accuracy}%`],
    ['Tổng số kẹo', t.totalCandies],
    ['Hộp quà đã mở', t.giftsOpened],
    ['Sticker đã mở khoá', t.stickersUnlocked],
  ] as const;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="card p-4">
            <div className="text-sm font-semibold text-ink/60">{label}</div>
            <div className="text-3xl font-extrabold">{value}</div>
          </div>
        ))}
      </div>
      <Panel title="Thống kê từng chương">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="text-sm text-ink/60">
              <tr>
                <th className="py-2">Chương</th>
                <th>Số bài</th>
                <th>Điểm cao nhất</th>
                <th>Số lần 10/10</th>
                <th>Tỷ lệ đúng</th>
                <th>Lần chơi gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {stats.chapters.map((c) => (
                <tr key={c.chapterId} className="border-t border-ink/10">
                  <td className="py-2 font-bold">{c.name}</td>
                  <td>{c.totalSessions}</td>
                  <td>{c.bestScore}/10</td>
                  <td>{c.perfectSessions}</td>
                  <td>{c.accuracy}%</td>
                  <td>{formatDateTime(c.lastPlayedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Sticker đã mở khoá">
        {stickers.length === 0 ? (
          <p className="text-ink/60">Chưa có sticker nào.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {stickers.map((s) => (
              <div key={s.code} className="flex items-center gap-2 rounded-2xl bg-cream px-3 py-2">
                <img src={stickerImage(s.code)} alt="" className="h-10 w-10" />
                <span className="font-semibold">
                  {getSticker(s.code)?.name ?? s.code} {s.quantity > 1 && `x${s.quantity}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function HistoryTab({ guard }: { guard: Guard }) {
  const [page, setPage] = useState(1);
  const [chapterId, setChapterId] = useState('');
  const [data, setData] = useState<HistoryPage | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  useEffect(() => {
    guard(() => api.history(page, 10, chapterId || undefined)).then(setData).catch(() => undefined);
  }, [page, chapterId, guard]);

  return (
    <Panel title="Lịch sử học tập">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="parent-input max-w-xs"
          value={chapterId}
          onChange={(e) => {
            setChapterId(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo chương"
        >
          <option value="">Tất cả chương</option>
          {getEnabledChapters().map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {data && <span className="text-ink/60">{data.total} bài</span>}
      </div>
      {!data ? (
        <LoadingMascotDots />
      ) : data.items.length === 0 ? (
        <p className="text-ink/60">Chưa có bài học nào.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="history-list">
          {data.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => guard(() => api.historyDetail(item.id)).then(setDetail).catch(() => undefined)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream px-4 py-3 text-left hover:bg-sunny-100"
              >
                <span className="font-bold">{item.chapterName}</span>
                <span className="text-ink/60">{formatDateTime(item.completedAt)}</span>
                <span className="font-extrabold">
                  {item.score}/10 {item.isPerfectScore && '🏆'}
                </span>
                <span className="text-sm text-ink/60">
                  Đúng {item.correctAnswers} · Sai {item.incorrectAnswers} · Kẹo +{item.candiesEarned}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" className="rounded-xl bg-white p-2 shadow-pop-sm disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước">
            <ChevronLeft />
          </button>
          <span className="font-bold">
            Trang {data.page}/{data.totalPages}
          </span>
          <button type="button" className="rounded-xl bg-white p-2 shadow-pop-sm disabled:opacity-40" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau">
            <ChevronRight />
          </button>
        </div>
      )}
      {detail && (
        <Modal onClose={() => setDetail(null)} title={`${detail.chapterName} – ${detail.score}/10`}>
          <p className="mb-2 text-ink/60">Hoàn thành: {formatDateTime(detail.completedAt)}</p>
          <table className="w-full text-left">
            <thead className="text-sm text-ink/60">
              <tr>
                <th>#</th>
                <th>Câu hỏi</th>
                <th>Đáp án</th>
                <th>Lần đầu chọn</th>
                <th>Số lần thử</th>
              </tr>
            </thead>
            <tbody>
              {detail.answers.map((a) => (
                <tr key={a.questionIndex} className="border-t border-ink/10">
                  <td className="py-1">{a.questionIndex + 1}</td>
                  <td>{a.prompt}</td>
                  <td className="font-bold">{a.correctLabel ?? a.correctAnswer}</td>
                  <td className={a.isCorrect ? 'font-bold text-mint-500' : 'font-bold text-bubblegum-500'}>{a.selectedLabel ?? a.selectedAnswer}</td>
                  <td>{a.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </Panel>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-2xl bg-cream px-4">
      <span className="font-bold">{label}</span>
      <input type="checkbox" className="h-7 w-7 accent-grape-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function SettingsTab({ guard }: { guard: Guard }) {
  const settings = useSettings();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Âm thanh & chuyển động">
        <div className="flex flex-col gap-2">
          <Toggle label="Bật âm thanh" checked={settings.soundEnabled} onChange={settings.setSoundEnabled} />
          <Toggle label="Giảm chuyển động (tắt pháo hoa, hiệu ứng nhảy)" checked={settings.reducedMotion} onChange={settings.setReducedMotion} />
        </div>
      </Panel>
      <FamilyPanel guard={guard} />
      <Panel title="Đổi mã PIN">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            guard(() => api.changePin(current, next))
              .then(() => {
                setMsg('Đã đổi mã PIN.');
                setCurrent('');
                setNext('');
              })
              .catch((err: Error) => setMsg(err.message));
          }}
        >
          <input className="parent-input" type="password" inputMode="numeric" placeholder="PIN hiện tại" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ''))} maxLength={6} autoComplete="current-password" />
          <input className="parent-input" type="password" inputMode="numeric" placeholder="PIN mới (4–6 số)" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ''))} maxLength={6} autoComplete="new-password" />
          <button type="submit" className="rounded-xl bg-grape-500 px-5 py-3 font-bold text-white">
            Đổi
          </button>
        </form>
        {msg && <p className="mt-2 font-semibold">{msg}</p>}
      </Panel>
    </div>
  );
}

/** Gia đình: tên, mã gia đình (đăng nhập trên máy mới), đăng xuất các máy. */
const GIFT_SUGGESTIONS = [
  { name: 'Thêm 15 phút xem hoạt hình', cost: 60 },
  { name: 'Được chọn món ăn tối', cost: 100 },
  { name: 'Đi ăn kem cùng bố mẹ', cost: 150 },
];

/** Quà thật đổi bằng xu (nhóm 5–9 tuổi): bố mẹ đặt quà, bé đổi, bố mẹ đánh dấu đã trao. */
function GiftsTab({ guard }: { guard: Guard }) {
  const [shop, setShop] = useState<ShopView | null>(null);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    guard(api.shop)
      .then(setShop)
      .catch(() => undefined);
  }, [guard]);

  const run = async (fn: () => Promise<ShopView>, okText?: string) => {
    setMsg(null);
    try {
      setShop(await guard(fn));
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Có lỗi xảy ra' });
    }
  };

  const add = (n: string, c: number) => {
    if (!n.trim()) return setMsg({ ok: false, text: 'Hãy nhập tên món quà.' });
    if (!Number.isInteger(c) || c < 1) return setMsg({ ok: false, text: 'Giá quà là số xu lớn hơn 0.' });
    void run(() => api.addShopReward(n.trim(), c), `Đã thêm "${n.trim()}".`).then(() => {
      setName('');
      setCost('');
    });
  };

  return (
    <>
      <Panel title="Quà đổi bằng xu (bé 5–9 tuổi)">
        <p className="mb-3 text-ink/70">
          Bé kiếm xu khi làm bài nhóm 5–9 tuổi: đúng ngay lần đầu <b>2 xu</b>, đúng sau khi thử lại <b>1 xu</b>; Thử thách 60 giây: 2 câu đúng = 1 xu.
          {shop && (
            <>
              {' '}
              Hiện bé có <b data-testid="parent-coins">{shop.coins.balance} xu</b> (đã kiếm {shop.coins.earned}, đã đổi {shop.coins.spent}).
            </>
          )}
        </p>
        <ul className="mb-4 flex flex-col gap-2" data-testid="parent-gift-list">
          {shop?.rewards.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-cream px-4 py-2">
              <span className="font-bold">
                {r.name} · <span className="text-ink/60">{r.cost} xu</span>
              </span>
              <button type="button" className="rounded-xl bg-white px-3 py-1 font-bold text-bubblegum-500 shadow-pop-sm" onClick={() => void run(() => api.removeShopReward(r.id))}>
                Bỏ
              </button>
            </li>
          ))}
          {shop && shop.rewards.length === 0 && <li className="text-ink/50">Chưa có món quà nào.</li>}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="parent-input flex-1" placeholder="Tên quà, vd. Đi công viên" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} data-testid="gift-name" />
          <input
            className="parent-input sm:w-32"
            inputMode="numeric"
            placeholder="Số xu"
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/\D/g, '').slice(0, 6))}
            data-testid="gift-cost"
          />
          <button type="button" className="rounded-2xl bg-grape-500 px-4 py-3 font-bold text-white" onClick={() => add(name, Number(cost))} data-testid="gift-add">
            Thêm quà
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {GIFT_SUGGESTIONS.map((g) => (
            <button key={g.name} type="button" className="rounded-full bg-sunny-100 px-3 py-1 text-sm font-bold" onClick={() => add(g.name, g.cost)}>
              + {g.name} ({g.cost} xu)
            </button>
          ))}
        </div>
        {msg && <p className={`mt-3 font-semibold ${msg.ok ? 'text-mint-500' : 'text-bubblegum-500'}`}>{msg.text}</p>}
      </Panel>

      <Panel title="Bé đã đổi">
        {shop && shop.redemptions.length === 0 && <p className="text-ink/50">Bé chưa đổi quà nào.</p>}
        <ul className="flex flex-col gap-2">
          {shop?.redemptions.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-cream px-4 py-2">
              <span className="flex flex-col">
                <span className="font-bold">{r.name}</span>
                <span className="text-sm text-ink/50">
                  {formatDateTime(r.redeemedAt)} · {r.cost} xu
                </span>
              </span>
              {r.deliveredAt ? (
                <span className="font-bold text-mint-500">Đã trao</span>
              ) : (
                <button type="button" className="rounded-xl bg-mint-400 px-3 py-2 font-bold text-white" onClick={() => void run(() => api.markDelivered(r.id))} data-testid="gift-deliver">
                  Đã trao quà
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function FamilyPanel({ guard }: { guard: Guard }) {
  const [name, setName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .familyStatus()
      .then((s) => setName(s.family?.name ?? null))
      .catch(() => undefined);
  }, []);

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await guard(fn);
      setMsg({ ok: true, text: okText });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Có lỗi xảy ra' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveCode = () => {
    if (!/^\d{4,8}$/.test(code)) return setMsg({ ok: false, text: 'Mã gia đình gồm 4–8 chữ số.' });
    if (code !== confirm) return setMsg({ ok: false, text: 'Hai lần nhập mã không khớp.' });
    void run(() => api.setFamilyCode(code), 'Đã đổi mã gia đình. Máy này được giữ, các máy khác cần đăng nhập lại bằng mã mới.').then(
      (ok) => {
        if (ok) {
          setCode('');
          setConfirm('');
        }
      },
    );
  };

  const saveName = () => {
    if (newName.trim().length < 2) return setMsg({ ok: false, text: 'Tên gia đình cần ít nhất 2 ký tự.' });
    void run(async () => {
      const r = await api.renameFamily(newName);
      setName(r.name);
      setNewName('');
    }, 'Đã đổi tên gia đình. Lần đăng nhập sau hãy dùng tên mới.');
  };

  return (
    <Panel title="Gia đình">
      <p className="mb-3 text-ink/70">
        Đang dùng: <b className="text-ink" data-testid="family-current-name">{name ?? '...'}</b>. Trên máy mới, đăng nhập bằng{' '}
        <b>tên gia đình + mã gia đình</b> (máy được nhớ 1 năm).
      </p>
      <div className="flex flex-col gap-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <input className="parent-input" placeholder="Tên gia đình mới" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} />
          <button type="submit" className="rounded-xl bg-grape-500 px-5 py-3 font-bold text-white" disabled={busy}>
            Đổi tên
          </button>
        </form>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            saveCode();
          }}
        >
          <input className="parent-input" type="password" inputMode="numeric" placeholder="Mã gia đình mới (4–8 số)" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} maxLength={8} autoComplete="new-password" data-testid="family-code-input" />
          <input className="parent-input" type="password" inputMode="numeric" placeholder="Nhập lại mã" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} maxLength={8} autoComplete="new-password" data-testid="family-code-confirm" />
          <button type="submit" className="rounded-xl bg-grape-500 px-5 py-3 font-bold text-white" disabled={busy} data-testid="family-code-save">
            Đổi mã
          </button>
        </form>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="rounded-xl bg-ink/10 px-4 py-3 font-bold"
            disabled={busy}
            onClick={() => void run(api.familyLogoutAll, 'Đã đăng xuất mọi máy khác. Các máy đó cần đăng nhập lại.')}
          >
            Đăng xuất mọi máy khác
          </button>
          <button
            type="button"
            className="rounded-xl bg-bubblegum-100 px-4 py-3 font-bold text-bubblegum-500"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Thoát gia đình trên máy này? Lần sau cần đăng nhập lại bằng tên + mã gia đình.')) return;
              void api
                .familyLogout()
                .catch(() => undefined)
                .finally(() => window.location.assign('/'));
            }}
            data-testid="family-logout"
          >
            Thoát gia đình trên máy này
          </button>
        </div>
      </div>
      {msg && <p className={`mt-2 font-semibold ${msg.ok ? 'text-mint-500' : 'text-bubblegum-500'}`}>{msg.text}</p>}
    </Panel>
  );
}

function DataTab({ guard }: { guard: Guard }) {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown; sessions: number } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setMsg(null);
    try {
      const backup = await guard(api.exportBackup);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `be-vui-hoc-toan-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: 'Đã xuất dữ liệu ra file JSON.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Xuất dữ liệu thất bại' });
    }
  };

  const onFile = async (file: File) => {
    setMsg(null);
    try {
      const data = JSON.parse(await file.text()) as { format?: unknown; schemaVersion?: unknown; data?: { sessions?: unknown[] } };
      if (data.format !== 'be-vui-hoc-toan-backup' || typeof data.schemaVersion !== 'number') {
        throw new Error('File không phải bản sao lưu của Bé Vui Học Toán.');
      }
      setPending({ name: file.name, data, sessions: Array.isArray(data.data?.sessions) ? data.data!.sessions!.length : 0 });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof SyntaxError ? 'File JSON bị lỗi, không đọc được.' : (e as Error).message });
    }
  };

  const doImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await guard(() => api.importBackup(pending.data));
      setMsg({ ok: true, text: `Đã khôi phục ${r.imported.sessions} bài học và ${r.imported.rewards} phần thưởng.` });
      const s = await api.settings();
      settings.applyServerSettings({ soundEnabled: s.soundEnabled, reducedMotion: s.reducedMotion, ageGroup: s.ageGroup });
    } catch (e) {
      const details = e instanceof ApiClientError && Array.isArray(e.details) ? ` (${(e.details as { path: string; message: string }[]).map((d) => `${d.path}: ${d.message}`).join('; ')})` : '';
      setMsg({ ok: false, text: `${(e as Error).message}${details}` });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const doReset = async () => {
    setBusy(true);
    try {
      await guard(api.resetAll);
      setMsg({ ok: true, text: 'Đã xoá toàn bộ tiến độ học tập.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
      setConfirmReset(false);
      setResetText('');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Sao lưu & khôi phục">
        <p className="mb-3 text-ink/70">Xuất toàn bộ lịch sử, tiến độ và phần thưởng ra file JSON. Có thể nhập lại file này để khôi phục dữ liệu.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={doExport} className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 font-bold text-white">
            <Download size={20} /> Xuất dữ liệu JSON
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-mint-500 px-5 py-3 font-bold text-white">
            <Upload size={20} /> Nhập dữ liệu JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </Panel>
      <Panel title="Xoá dữ liệu">
        <p className="mb-3 text-ink/70">Xoá toàn bộ lịch sử học, kẹo và sticker. Mã PIN được giữ nguyên. Nên xuất dữ liệu trước khi xoá.</p>
        <button type="button" onClick={() => setConfirmReset(true)} className="flex items-center gap-2 rounded-xl bg-bubblegum-500 px-5 py-3 font-bold text-white">
          <Trash2 size={20} /> Xoá toàn bộ tiến độ
        </button>
      </Panel>
      {msg && (
        <p role="status" className={`rounded-2xl p-4 font-semibold ${msg.ok ? 'bg-mint-100' : 'bg-bubblegum-100'}`}>
          {msg.text}
        </p>
      )}
      {pending && (
        <Modal title="Xác nhận ghi đè dữ liệu" onClose={() => setPending(null)}>
          <p className="mb-4">
            Nhập file <b>{pending.name}</b> ({pending.sessions} bài học) sẽ <b>thay thế toàn bộ</b> dữ liệu học tập hiện tại. Bạn chắc chắn chứ?
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-xl bg-white px-4 py-3 font-bold shadow-pop-sm" onClick={() => setPending(null)}>
              Huỷ
            </button>
            <button type="button" className="rounded-xl bg-mint-500 px-4 py-3 font-bold text-white" disabled={busy} onClick={doImport}>
              Ghi đè & khôi phục
            </button>
          </div>
        </Modal>
      )}
      {confirmReset && (
        <Modal title="Xoá toàn bộ tiến độ?" onClose={() => setConfirmReset(false)}>
          <p className="mb-2">Thao tác này không thể hoàn tác. Gõ <b>XOA</b> để xác nhận.</p>
          <input className="parent-input mb-4" value={resetText} onChange={(e) => setResetText(e.target.value.toUpperCase())} aria-label="Gõ XOA để xác nhận" />
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-xl bg-white px-4 py-3 font-bold shadow-pop-sm" onClick={() => setConfirmReset(false)}>
              Huỷ
            </button>
            <button type="button" className="rounded-xl bg-bubblegum-500 px-4 py-3 font-bold text-white disabled:opacity-40" disabled={resetText !== 'XOA' || busy} onClick={doReset}>
              Xoá vĩnh viễn
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xl font-extrabold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-xl p-2 hover:bg-ink/5">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
