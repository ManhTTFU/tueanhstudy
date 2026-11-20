import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache } from '../utils/storage';

/**
 * Tải dữ liệu 1 lần khi mount (không polling).
 * Có `cacheKey` => hiện ngay bản đã lưu của lần trước, rồi thay bằng dữ liệu mới từ máy chủ.
 */
export function useApiData<T>(loader: () => Promise<T>, cacheKey?: string) {
  const [data, setData] = useState<T | null>(() => (cacheKey ? readCache<T>(cacheKey) : null));
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await loaderRef.current();
      setData(fresh);
      setError(null);
      if (cacheKeyRef.current) writeCache(cacheKeyRef.current, fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
