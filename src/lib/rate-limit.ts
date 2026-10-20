/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * NOTE FOR PRODUCTION: this store lives in the memory of a single Node process.
 * It is therefore *per-instance* — on serverless (Vercel/Lambda) or behind a load
 * balancer each instance keeps its own counters, so the effective limit multiplies
 * with the number of instances, and counters reset on every cold start / redeploy.
 *
 * For a multi-instance deployment replace the `buckets` Map with a shared store
 * such as Redis (e.g. `INCR` + `EXPIRE` in an atomic pipeline, or the
 * `@upstash/ratelimit` / `rate-limiter-flexible` packages) and keep this
 * interface unchanged.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

function sweep(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Registers one attempt against `key` and reports whether it is allowed.
 * The counter is incremented even for rejected attempts so a client cannot
 * keep hammering an endpoint by ignoring the 429 response.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Clears the counter for a single key (used after a successful login). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test helper — wipes every bucket. */
export function resetAllRateLimits(): void {
  buckets.clear();
}
