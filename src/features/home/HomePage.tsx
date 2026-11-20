/**
 * Trang chủ: header, các chương học (lấy từ hệ thống đăng ký – không viết cứng),
 * khu vực phần thưởng.
 */
import { motion } from 'framer-motion';
import { Award, BookCheck, ChevronRight, Gift, Play, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../../app/SettingsContext';
import { getHomeChapters } from '../../chapters/registry';
import type { AgeGroup } from '../../engine/types';
import { getChapterUI } from '../../chapters/ui-registry';
import { AppHeader } from '../../components/AppHeader';
import { InstallHint } from '../../components/InstallHint';
import { PageShell, ProgressBar, Stars } from '../../components/ui';
import { getSticker, stickerImage, STICKERS } from '../../data/stickers';
import { useApiData } from '../../hooks/useApiData';
import { api, type Summary } from '../../services/api';
import { AudioController } from '../audio/AudioController';
import { PrimaryExtras } from '../primary/PrimaryExtras';

export function HomePage() {
  const { data: summary, error, reload } = useApiData(api.summary);
  // Xu, kỷ lục, câu cần ôn, hạng tuần – chỉ dùng cho nhóm 5–9 tuổi.
  const { data: overview, reload: reloadOverview } = useApiData(api.primaryOverview);
  const { ageGroup, setAgeGroup } = useSettings();
  const chapters = getHomeChapters(ageGroup);
  const navigate = useNavigate();

  return (
    <PageShell>
      <AppHeader
        progress={summary?.overallProgress ?? 0}
        candies={summary?.totals.totalCandies ?? 0}
        coins={ageGroup === 'primary' ? (overview?.coins.balance ?? 0) : undefined}
      />

      {error && (
        <p className="mt-3 rounded-2xl bg-white/70 px-4 py-2 text-center text-sm text-ink/60">
          Chưa kết nối được máy chủ – bé vẫn chơi được nhưng kết quả chưa được lưu.
        </p>
      )}

      <InstallHint />

      <AgeSwitch
        value={ageGroup}
        onChange={(v) => {
          AudioController.sfx('tap');
          // Tiến độ tổng chỉ tính các chương của nhóm tuổi đang chọn => tải lại sau khi lưu.
          void setAgeGroup(v).then(() => Promise.all([reload(), reloadOverview()]));
        }}
      />

      <section className="mt-4" aria-label="Chọn chương học">
        <div className="grid gap-5 md:grid-cols-2">
          {chapters.map((chapter, i) => {
            const ui = getChapterUI(chapter.id);
            if (!ui) return null;
            const progress = summary?.chapters.find((c) => c.chapterId === chapter.id);
            const { Illustration, Icon } = ui;
            return (
              <motion.article
                key={chapter.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.12 }}
                className="card flex flex-col overflow-hidden"
                data-testid="chapter-card"
                data-chapter={chapter.id}
              >
                <button
                  type="button"
                  className="h-36 w-full px-4 sm:h-44"
                  style={{ backgroundColor: chapter.theme.soft }}
                  onClick={() => {
                    AudioController.sfx('tap');
                    void AudioController.speak(ui.introVoice);
                  }}
                  aria-label={`Nghe tên chương ${chapter.name}`}
                >
                  <Illustration />
                </button>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase" style={{ color: chapter.theme.strong }}>
                      <Icon size={30} strokeWidth={3} /> {chapter.name}
                    </h2>
                    <Stars count={progress?.stars ?? 0} />
                  </div>
                  <p className="text-xl font-semibold text-ink/70">{chapter.description}</p>
                  <button
                    type="button"
                    className="kid-btn mt-auto w-full text-white"
                    style={{ backgroundColor: chapter.theme.primary }}
                    onClick={() => {
                      AudioController.sfx('tap');
                      navigate(`/chuong/${chapter.id}`);
                    }}
                  >
                    <Play size={30} fill="currentColor" /> Bắt đầu học
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      {ageGroup === 'primary' && <PrimaryExtras data={overview} />}

      {/* Kẹo, hộp quà, sticker chỉ dành cho bé 3–5 tuổi; nhóm 5–9 tuổi dùng xu & Đổi quà. */}
      {ageGroup === 'preschool' && <RewardZone summary={summary} />}
    </PageShell>
  );
}

const AGE_TABS: { id: AgeGroup; emoji: string; label: string; sub: string }[] = [
  { id: 'preschool', emoji: '🧸', label: 'Bé 3–5 tuổi', sub: 'Mầm non' },
  { id: 'primary', emoji: '🎒', label: 'Bé 5–9 tuổi', sub: 'Tiểu học' },
];

/** Chọn nhóm tuổi: mỗi nhóm có các chương riêng (lưu trong cài đặt gia đình). */
function AgeSwitch({ value, onChange }: { value: AgeGroup; onChange: (v: AgeGroup) => void }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2 rounded-4xl bg-white/70 p-2 shadow-pop-sm" role="tablist" aria-label="Chọn nhóm tuổi">
      {AGE_TABS.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={`age-${t.id}`}
            onClick={() => !on && onChange(t.id)}
            className={`flex min-h-[64px] items-center justify-center gap-2 rounded-3xl px-3 py-2 transition-colors ${on ? 'bg-grape-500 text-white shadow-pop-sm' : 'text-ink/70'}`}
          >
            <span className="text-3xl" aria-hidden>
              {t.emoji}
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xl font-extrabold sm:text-2xl">{t.label}</span>
              <span className={`text-sm font-bold ${on ? 'text-white/80' : 'text-ink/50'}`}>{t.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function highlight(summary: Summary | null): { title: string; detail: string; image?: string } {
  if (!summary) return { title: 'Thành tích', detail: 'Cùng chơi bài đầu tiên nhé!' };
  const latest = [...summary.stickers].sort((a, b) => b.firstEarnedAt.localeCompare(a.firstEarnedAt))[0];
  const perfect = summary.chapters.reduce((s, c) => s + c.perfectSessions, 0);
  if (latest) {
    return { title: 'Sticker mới nhất', detail: getSticker(latest.code)?.name ?? latest.code, image: stickerImage(latest.code) };
  }
  if (perfect > 0) return { title: 'Điểm tuyệt đối', detail: `Đạt 10/10: ${perfect} lần` };
  if (summary.totals.totalCompletedQuizzes > 0) return { title: 'Chăm chỉ quá', detail: `Đã chơi ${summary.totals.totalCompletedQuizzes} bài` };
  return { title: 'Thành tích', detail: 'Cùng chơi bài đầu tiên nhé!' };
}

function RewardZone({ summary }: { summary: Summary | null }) {
  const totals = summary?.totals;
  const owned = summary?.stickers ?? [];
  const h = highlight(summary);
  return (
    <section className="mt-8" aria-label="Phần thưởng">
      <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold">
        <Sparkles className="text-sunny-500" /> Phần thưởng của bé
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile color="#FFF4CC" testId="tile-candies">
          <img src="/assets/rewards/candy.svg" alt="" className="h-14 w-14" />
          <span className="text-4xl font-extrabold">{totals?.totalCandies ?? 0}</span>
          <span className="font-bold text-ink/60">Viên kẹo</span>
        </Tile>
        <Tile color="#DDF8EC" testId="tile-completed">
          <BookCheck size={52} className="text-mint-500" />
          <span className="text-4xl font-extrabold">{totals?.totalCompletedQuizzes ?? 0}</span>
          <span className="font-bold text-ink/60">Bài đã hoàn thành</span>
        </Tile>
        <Tile color="#EEE5FF">
          {h.image ? <img src={h.image} alt="" className="h-14 w-14" /> : <Award size={52} className="text-grape-500" />}
          <span className="text-xl font-extrabold">{h.detail}</span>
          <span className="font-bold text-ink/60">{h.title}</span>
        </Tile>
        <Tile color="#FFE3EE">
          <Gift size={52} className="text-bubblegum-500" />
          {totals && totals.giftsAvailable > 0 ? (
            <span className="text-xl font-extrabold">Có {totals.giftsAvailable} hộp quà!</span>
          ) : (
            <span className="text-xl font-extrabold">Còn {totals?.candiesUntilNextGift ?? 10} kẹo</span>
          )}
          <span className="font-bold text-ink/60">Hộp quà</span>
        </Tile>
      </div>

      <Link to="/bo-suu-tap" className="card mt-4 flex items-center gap-4 p-4 transition-transform active:scale-[0.99]" data-testid="sticker-collection-link">
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-xl font-extrabold">
            Bộ sưu tập sticker ({owned.length}/{STICKERS.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {owned.slice(0, 8).map((s) => (
              <img key={s.code} src={stickerImage(s.code)} alt={getSticker(s.code)?.name ?? ''} className="h-12 w-12" />
            ))}
            {owned.length === 0 && <span className="text-ink/50">Chưa có sticker nào – đạt 10/10 để nhận nhé!</span>}
          </div>
          <ProgressBar value={owned.length} max={STICKERS.length} color="#A07BFF" label="Tiến độ sưu tập" />
        </div>
        <ChevronRight size={40} className="text-ink/40" />
      </Link>
    </section>
  );
}

function Tile({ color, children, testId }: { color: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-4xl p-4 text-center shadow-pop-sm" style={{ backgroundColor: color }} data-testid={testId}>
      {children}
    </div>
  );
}
