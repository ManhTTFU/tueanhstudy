/**
 * Bảng xếp hạng (nhóm 5–9 tuổi): các gia đình xếp theo số xu kiếm được
 * trong tuần này (tính từ thứ Hai, giờ Việt Nam) hoặc từ trước tới nay.
 */
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { BackButton, PageShell } from '../../components/ui';
import { useApiData } from '../../hooks/useApiData';
import { api, type LeaderboardRow } from '../../services/api';

const MEDALS = ['🥇', '🥈', '🥉'];

function Rows({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <ol className="flex flex-col gap-2" data-testid="leaderboard-rows">
      {rows.map((r, i) => (
        <li
          key={`${r.name}-${i}`}
          className={`flex items-center gap-3 rounded-3xl px-4 py-3 shadow-pop-sm ${r.me ? 'bg-grape-100 ring-4 ring-grape-300' : 'bg-white'}`}
          data-me={r.me || undefined}
        >
          <span className="w-10 text-center text-3xl font-extrabold">{MEDALS[r.rank - 1] ?? r.rank}</span>
          <span className="flex-1 text-xl font-bold">
            {r.name}
            {r.me && <span className="ml-1 text-base text-grape-500">(nhà mình)</span>}
          </span>
          <span className="text-xl font-extrabold tabular-nums">🪙 {r.coins}</span>
        </li>
      ))}
    </ol>
  );
}

export function LeaderboardPage() {
  const { data, error } = useApiData(api.leaderboard);
  const [tab, setTab] = useState<'week' | 'allTime'>('week');
  const daysLeft = data ? Math.max(1, Math.ceil((new Date(data.weekEnd).getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-3">
        <BackButton to="/" />
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Trophy className="text-sunny-500" /> Bảng xếp hạng
        </h1>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-4xl bg-white/70 p-2 shadow-pop-sm" role="tablist">
        {(
          [
            ['week', 'Tuần này'],
            ['allTime', 'Từ trước tới nay'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-[52px] rounded-3xl text-lg font-extrabold ${tab === id ? 'bg-sunny-400 text-ink' : 'text-ink/60'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-center text-ink/60">Cần có mạng để xem bảng xếp hạng.</p>}
      {data && (
        <>
          <p className="mb-3 text-center font-semibold text-ink/60">
            {tab === 'week' ? `Xếp theo xu kiếm được tuần này · còn ${daysLeft} ngày nữa là sang tuần mới` : 'Xếp theo tổng xu kiếm được'}
          </p>
          <Rows rows={tab === 'week' ? data.week : data.allTime} />
          <p className="mt-4 text-center text-sm text-ink/50">Làm bài đúng ngay lần đầu được 2 xu, đúng sau khi thử lại được 1 xu. Đổi quà không làm giảm điểm xếp hạng.</p>
        </>
      )}
    </PageShell>
  );
}
