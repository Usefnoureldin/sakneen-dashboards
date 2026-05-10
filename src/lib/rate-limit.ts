/**
 * Simple in-memory sliding-window rate limiter. Single-instance only — fine for
 * Railway MVP (one Next.js service, one process). Migrate to Redis when we scale out.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
};

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.max(1000, oldest + windowMs - now),
    };
  }
  bucket.hits.push(now);
  return {
    ok: true,
    remaining: limit - bucket.hits.length,
    resetMs: windowMs,
  };
}

// Periodic GC so the Map doesn't grow unbounded.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (b.hits.length === 0 || b.hits[b.hits.length - 1] < now - 30 * 60 * 1000) {
        buckets.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}
