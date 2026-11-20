/**
 * Khu "Luyện thêm" trên trang chủ nhóm 5–9 tuổi: Thử thách 60 giây, Ôn câu sai,
 * Đổi quà, Bảng xếp hạng.
 */
import { Gift, RotateCcw, Timer, Trophy, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PrimaryOverview } from '../../services/api';
import { AudioController } from '../audio/AudioController';

function Tile({ to, Icon, color, title, badge, sub, testId }: { to: string; Icon: LucideIcon; color: string; title: string; badge: string; sub: string; testId: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="flex min-h-[132px] flex-col items-start gap-1 rounded-4xl p-4 text-left shadow-pop-sm transition-transform active:scale-[0.98]"
      style={{ backgroundColor: color }}
      onClick={() => {
        AudioController.sfx('tap');
        navigate(to);
      }}
      data-testid={testId}
    >
      <span className="rounded-full bg-white/80 px-3 py-0.5 text-sm font-extrabold">{badge}</span>
      <span className="flex items-center gap-2 text-xl font-extrabold">
        <Icon size={24} /> {title}
      </span>
      <span className="text-sm font-semibold text-ink/70">{sub}</span>
    </button>
  );
}

export function PrimaryExtras({ data }: { data: PrimaryOverview | null }) {
  return (
    <section className="mt-6" aria-label="Luyện thêm">
      <h2 className="mb-3 text-2xl font-extrabold">Luyện thêm</h2>
      <div className="grid grid-cols-2 gap-3">
        <Tile to="/thu-thach" Icon={Timer} color="#FFE9DC" title="Thử thách 60 giây" badge={`Kỷ lục: ${data?.challengeBest ?? 0}`} sub="Nhẩm thật nhanh cộng, trừ qua 10" testId="tile-challenge" />
        <Tile to="/chuong/pm-review/choi" Icon={RotateCcw} color="#DDF3FF" title="Ôn câu sai" badge={`${data?.reviewCount ?? 0} câu`} sub="Làm lại câu đã sai để nhớ lâu" testId="tile-review" />
        <Tile to="/doi-qua" Icon={Gift} color="#FFE3EE" title="Đổi quà" badge={`🪙 ${data?.coins.balance ?? 0} xu`} sub="Dùng xu đổi quà bố mẹ hứa" testId="tile-shop" />
        <Tile
          to="/bang-xep-hang"
          Icon={Trophy}
          color="#FFF4CC"
          title="Bảng xếp hạng"
          badge={data ? `Hạng ${data.weekRank}/${data.families}` : 'Tuần này'}
          sub={`Tuần này: ${data?.weekCoins ?? 0} xu`}
          testId="tile-leaderboard"
        />
      </div>
    </section>
  );
}
