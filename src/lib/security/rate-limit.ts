import { RateLimited } from "@/lib/errors";

/**
 * Lightweight fixed-window rate limiter.
 *
 * Default backend is an in-memory Map — correct for a single Node instance and
 * good enough for local/dev and low-traffic deployments. For multi-instance or
 * serverless production you MUST swap in a shared store (Upstash Redis); see
 * SECURITY.md. The interface below is deliberately store-agnostic so swapping
 * the backend does not touch call sites.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Opportunistic cleanup to bound memory in long-lived instances.
function sweep(now: number) {
  if (store.size < 5_000) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
};

export function rateLimit(
  identifier: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = store.get(identifier);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    store.set(identifier, { count: 1, resetAt });
    return { success: true, remaining: opts.limit - 1, limit: opts.limit, resetAt };
  }

  bucket.count += 1;
  const remaining = Math.max(0, opts.limit - bucket.count);
  return {
    success: bucket.count <= opts.limit,
    remaining,
    limit: opts.limit,
    resetAt: bucket.resetAt,
  };
}

/** Throws RateLimited if the identifier has exceeded the window. */
export function enforceRateLimit(
  identifier: string,
  opts: { limit: number; windowMs: number },
): void {
  const result = rateLimit(identifier, opts);
  if (!result.success) {
    throw RateLimited(
      `Rate limit exceeded. Try again in ${Math.ceil(
        (result.resetAt - Date.now()) / 1000,
      )}s.`,
    );
  }
}

/** Common presets. */
export const RATE_LIMITS = {
  AUTH: { limit: 10, windowMs: 60_000 }, // 10/min per IP for auth endpoints
  STRICT: { limit: 5, windowMs: 60_000 }, // password reset / verify
  API: { limit: 120, windowMs: 60_000 }, // general API
  WEBHOOK: { limit: 300, windowMs: 60_000 },
} as const;
