/** Minimal in-memory sliding-window rate limiter (per IP). */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const SWEEP_MS = 60 * 60 * 1000;

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }

  bucket.hits.push(now);
  return { allowed: true, retryAfterSec: 0 };
}

/** Best-effort client IP from request headers. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "local";
}

// Prevent unbounded growth of the buckets map
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < SWEEP_MS);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}, SWEEP_MS).unref();
