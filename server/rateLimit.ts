/**
 * Giới hạn tần suất trong bộ nhớ (theo IP, theo từng instance serverless).
 * Đây là lớp bảo vệ "best-effort"; các giới hạn quan trọng (đăng nhập PIN,
 * số phiên mở) còn được kiểm tra bền vững trong database.
 */
import { tooManyRequests } from './errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

export const RATE_LIMITS = {
  default: { limit: 120, windowMs: 60_000 },
  write: { limit: 40, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
  heavy: { limit: 5, windowMs: 60_000 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

const buckets = new Map<string, Bucket>();

export function checkRateLimit(name: RateLimitName, key: string, now = Date.now()): void {
  const { limit, windowMs } = RATE_LIMITS[name];
  const id = `${name}:${key}`;
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5_000) cleanup(now);
    return;
  }
  bucket.count++;
  if (bucket.count > limit) throw tooManyRequests();
}

function cleanup(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function resetRateLimits(): void {
  buckets.clear();
}
