/**
 * Cài đặt âm thanh & chuyển động.
 * Nguồn chính: database (qua API). Bản sao trong localStorage chỉ để hiển thị
 * đúng ngay khi mở app (không chứa thông tin nhạy cảm).
 */
import { MotionConfig } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimationController } from '../features/animation/AnimationController';
import { AudioController } from '../features/audio/AudioController';
import type { AgeGroup } from '../engine/types';
import { api } from '../services/api';
import { readLocal, writeLocal } from '../utils/storage';

interface SettingsState {
  soundEnabled: boolean;
  reducedMotion: boolean;
  /** Nhóm tuổi đang chọn ở trang chủ (3–5 tuổi / 5–9 tuổi). */
  ageGroup: AgeGroup;
}

interface SettingsContextValue extends SettingsState {
  setSoundEnabled: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  /** Lưu nhóm tuổi; Promise xong khi server đã lưu (để tải lại tiến độ theo nhóm mới). */
  setAgeGroup: (v: AgeGroup) => Promise<void>;
  /** Đồng bộ từ server (ví dụ sau khi nhập dữ liệu). */
  applyServerSettings: (s: Partial<SettingsState>) => void;
}

const CACHE_KEY = 'bvht:prefs';
const SettingsContext = createContext<SettingsContextValue | null>(null);

function systemPrefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(() => ({
    soundEnabled: true,
    reducedMotion: systemPrefersReducedMotion(),
    ageGroup: 'preschool',
    ...readLocal<SettingsState>(CACHE_KEY),
  }));

  useEffect(() => {
    AudioController.setEnabled(state.soundEnabled);
    AnimationController.setReducedMotion(state.reducedMotion);
    writeLocal(CACHE_KEY, state);
  }, [state]);

  useEffect(() => {
    api
      .settings()
      .then((s) =>
        setState({ soundEnabled: s.soundEnabled, reducedMotion: s.reducedMotion || systemPrefersReducedMotion(), ageGroup: s.ageGroup ?? 'preschool' }),
      )
      .catch(() => undefined);
  }, []);

  const update = useCallback((patch: Partial<SettingsState>) => {
    setState((prev) => ({ ...prev, ...patch }));
    return api.updateSettings(patch).then(
      () => undefined,
      () => undefined,
    );
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...state,
      setSoundEnabled: (v) => void update({ soundEnabled: v }),
      setReducedMotion: (v) => void update({ reducedMotion: v }),
      setAgeGroup: (v) => update({ ageGroup: v }),
      applyServerSettings: (s) => setState((prev) => ({ ...prev, ...s })),
    }),
    [state, update],
  );

  return (
    <SettingsContext.Provider value={value}>
      <MotionConfig reducedMotion={state.reducedMotion ? 'always' : 'never'}>{children}</MotionConfig>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings phải nằm trong SettingsProvider');
  return ctx;
}
