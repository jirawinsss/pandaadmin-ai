import "server-only";

// Per-IP fixed-window rate limiter.
// In-memory only (per Node process). Acceptable trade-off: a multi-process
// host can multiply effective limits by N processes — still bounds bot traffic.
// No setInterval / background timer — cleanup runs lazily when the map grows.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function lazyCleanup(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  // Drop expired entries first
  for (const [k, v] of buckets) {
    if (now > v.resetAt) buckets.delete(k);
    if (buckets.size <= MAX_BUCKETS / 2) break;
  }
  // Still too big? Drop oldest (Map preserves insertion order)
  if (buckets.size >= MAX_BUCKETS) {
    const drop = buckets.size - MAX_BUCKETS / 2;
    let i = 0;
    for (const k of buckets.keys()) {
      if (i++ >= drop) break;
      buckets.delete(k);
    }
  }
}

/**
 * Try to consume one token from `key`'s bucket.
 * @returns true if allowed, false if rate-limited
 */
export function consumeBucket(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  lazyCleanup(now);

  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

/**
 * Best-effort client IP extraction. Returns "unknown" if no header is set —
 * all unknown clients then share one bucket (intentional: limits aggregate
 * unauthenticated traffic).
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}
