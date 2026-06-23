import { RateLimited } from "@/lib/errors";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Fixed-window rate limiter with two interchangeable backends:
 *
 *  - **Upstash Redis (REST)** — used when `RATE_LIMIT_REDIS_URL` +
 *    `RATE_LIMIT_REDIS_TOKEN` are set. This is the correct choice for
 *    serverless / multi-instance production (e.g. Netlify Functions), where
 *    each invocation may run in a fresh isolate with no shared memory. The REST
 *    transport works in serverless/edge runtimes without a TCP socket.
 *  - **In-memory Map** — automatic fallback for local dev / single instance.
 *    Counts are per-process, so it does NOT bound traffic across many isolates.
 *
 * Call sites only see `enforceRateLimit`; swapping the backend never touches them.
 * The functions are async because the Redis path is a network round-trip.
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

const REDIS_ENABLED = Boolean(
  env.RATE_LIMIT_REDIS_URL && env.RATE_LIMIT_REDIS_TOKEN,
);

function rateLimitMemory(
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

type UpstashReply = { result?: number | string | null; error?: string };

/**
 * Atomic-enough fixed window via an Upstash REST pipeline:
 *   INCR key                      → current count in this window
 *   PEXPIRE key windowMs NX       → set the window TTL only on first hit
 *   PTTL key                      → ms remaining (for the reset hint)
 *
 * Fails OPEN: a Redis outage must never lock every user out. We log and allow,
 * because webhook authenticity is still guaranteed by md5sig verification and
 * auth still requires valid credentials — the limiter is defence-in-depth.
 */
async function rateLimitRedis(
  identifier: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = `rl:${identifier}`;
  try {
    const res = await fetch(`${env.RATE_LIMIT_REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RATE_LIMIT_REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, opts.windowMs, "NX"],
        ["PTTL", key],
      ]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);

    const data = (await res.json()) as UpstashReply[];
    const count = Number(data[0]?.result ?? 0);
    const ttl = Number(data[2]?.result ?? opts.windowMs);
    const resetAt = now + (ttl >= 0 ? ttl : opts.windowMs);

    return {
      success: count <= opts.limit,
      remaining: Math.max(0, opts.limit - count),
      limit: opts.limit,
      resetAt,
    };
  } catch (err) {
    logger.error("Rate limiter (Redis) unavailable; failing open", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: true,
      remaining: opts.limit - 1,
      limit: opts.limit,
      resetAt: now + opts.windowMs,
    };
  }
}

export async function rateLimit(
  identifier: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  return REDIS_ENABLED
    ? rateLimitRedis(identifier, opts)
    : rateLimitMemory(identifier, opts);
}

/** Throws RateLimited if the identifier has exceeded the window. */
export async function enforceRateLimit(
  identifier: string,
  opts: { limit: number; windowMs: number },
): Promise<void> {
  const result = await rateLimit(identifier, opts);
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
