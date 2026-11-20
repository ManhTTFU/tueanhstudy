/**
 * Bộ nhớ trình duyệt CHỈ dùng cho tuỳ chọn hiển thị (bộ đệm), không phải database.
 * Mọi lỗi (chế độ riêng tư, bị chặn) đều được bỏ qua an toàn.
 */
export function readLocal<T>(key: string): Partial<T> | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : undefined;
  } catch {
    return undefined;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // bỏ qua
  }
}

/**
 * Bộ đệm dữ liệu API (tiến độ, kẹo, xu...) để mở app là hiện ngay số liệu lần trước,
 * sau đó cập nhật khi máy chủ trả về. Chỉ để hiển thị – máy chủ vẫn là nguồn chính.
 */
const DATA_CACHE_PREFIX = 'bvht:cache:';
/** Máy này đã đăng nhập gia đình ở lần mở trước => mở app ngay, kiểm tra lại ở nền. */
const FAMILY_FLAG_KEY = 'bvht:family';

export function readCache<T>(name: string): T | null {
  try {
    const raw = window.localStorage.getItem(DATA_CACHE_PREFIX + name);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(name: string, value: unknown): void {
  writeLocal(DATA_CACHE_PREFIX + name, value);
}

/** Xoá toàn bộ bộ đệm dữ liệu (đổi gia đình / thoát gia đình). */
export function clearDataCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(DATA_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // bỏ qua
  }
}

export function wasFamilyLoggedIn(): boolean {
  try {
    return window.localStorage.getItem(FAMILY_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberFamilyLogin(): void {
  try {
    window.localStorage.setItem(FAMILY_FLAG_KEY, '1');
  } catch {
    // bỏ qua
  }
}

/** Quên gia đình trên máy này: xoá cờ đăng nhập và số liệu đã lưu đệm. */
export function forgetFamilyOnDevice(): void {
  try {
    window.localStorage.removeItem(FAMILY_FLAG_KEY);
  } catch {
    // bỏ qua
  }
  clearDataCache();
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Dự phòng cho trình duyệt cũ: UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
