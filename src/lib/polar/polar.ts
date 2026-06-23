import crypto from "node:crypto";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Polar (https://polar.sh) integration helpers — used when PAYMENT_PROVIDER=polar.
 *
 * Polar is a Merchant of Record: we create a hosted checkout via the REST API
 * (server-side, with the organization access token), redirect the customer to
 * `checkout.url`, and Polar calls our webhook with the authoritative result.
 * As with PayHere, the WEBHOOK is the source of truth — never the browser
 * return. Webhooks are signed per the Standard Webhooks spec (HMAC-SHA256).
 *
 * Docs: https://polar.sh/docs/api-reference/checkouts/create-session
 *       https://polar.sh/docs/integrate/webhooks
 */

const API_BASE =
  env.POLAR_SERVER === "production"
    ? "https://api.polar.sh"
    : "https://sandbox-api.polar.sh";

export function isPolarConfigured(): boolean {
  return Boolean(env.POLAR_ACCESS_TOKEN);
}

function requireToken(): string {
  if (!env.POLAR_ACCESS_TOKEN) {
    throw new Error(
      "Polar is selected (PAYMENT_PROVIDER=polar) but POLAR_ACCESS_TOKEN is not set.",
    );
  }
  return env.POLAR_ACCESS_TOKEN;
}

export type PolarCheckoutResult = { id: string; url: string };

/**
 * Create a hosted Polar checkout session for a single product. `metadata` is
 * echoed back on the resulting order/subscription webhooks, so we use it to
 * carry our internal subscription id + order id for reconciliation.
 */
export async function createPolarCheckout(params: {
  productId: string;
  successUrl: string;
  customer: { name: string; email: string };
  metadata: Record<string, string>;
}): Promise<PolarCheckoutResult> {
  const res = await fetch(`${API_BASE}/v1/checkouts/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products: [params.productId],
      success_url: params.successUrl,
      customer_email: params.customer.email,
      customer_name: params.customer.name,
      metadata: params.metadata,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("Polar checkout creation failed", {
      status: res.status,
      detail: detail.slice(0, 500),
    });
    throw new Error(`Polar checkout failed (HTTP ${res.status})`);
  }

  const json = (await res.json()) as { id: string; url: string };
  return { id: json.id, url: json.url };
}

/**
 * Cancel a Polar subscription. Fail-soft like the PayHere equivalent: on any
 * error we report `cancelled:false` so the caller still cancels locally and
 * surfaces a notice rather than throwing.
 */
export async function cancelPolarSubscription(
  subscriptionId: string,
): Promise<{ cancelled: boolean; reason?: string }> {
  if (!isPolarConfigured()) {
    return { cancelled: false, reason: "Polar not configured; cancelled locally only." };
  }
  try {
    const res = await fetch(`${API_BASE}/v1/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${requireToken()}` },
      cache: "no-store",
    });
    if (res.ok) return { cancelled: true };
    return { cancelled: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    logger.error("Polar subscription cancel failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { cancelled: false, reason: "Request error" };
  }
}

const WEBHOOK_TOLERANCE_MS = 5 * 60_000; // reject stale/replayed timestamps

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export type PolarWebhookEvent = {
  type: string;
  data: Record<string, unknown>;
};

/**
 * Verify a Polar webhook per the Standard Webhooks spec and return the parsed
 * event. Throws on any verification failure (fail-closed). We parse the *raw*
 * body ourselves so we read Polar's snake_case payload directly.
 *
 * signature base = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 * expected       = base64( HMAC_SHA256( base64decode(secret), base ) )
 * header         = space-separated list of `v1,<signature>`
 */
export function verifyPolarWebhook(
  rawBody: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
): PolarWebhookEvent {
  if (!env.POLAR_WEBHOOK_SECRET) {
    throw new Error("POLAR_WEBHOOK_SECRET is not set");
  }
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    throw new Error("Missing Standard Webhooks headers");
  }

  const tsMs = Number(timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > WEBHOOK_TOLERANCE_MS) {
    throw new Error("Webhook timestamp outside tolerance");
  }

  // Standard Webhooks secrets are base64, optionally prefixed `whsec_`.
  const rawSecret = env.POLAR_WEBHOOK_SECRET.startsWith("whsec_")
    ? env.POLAR_WEBHOOK_SECRET.slice(6)
    : env.POLAR_WEBHOOK_SECRET;
  const key = Buffer.from(rawSecret, "base64");

  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  // Header looks like "v1,<sig> v1,<sig2>"; accept if any v1 entry matches.
  const provided = signature
    .split(" ")
    .map((part) => part.split(",", 2))
    .filter(
      (parts): parts is [string, string] =>
        parts[0] === "v1" && typeof parts[1] === "string",
    )
    .map(([, sig]) => sig);

  const ok = provided.some((sig) => timingSafeStringEqual(sig, expected));
  if (!ok) throw new Error("Invalid webhook signature");

  return JSON.parse(rawBody) as PolarWebhookEvent;
}

export const polarConfig = {
  apiBase: API_BASE,
  server: env.POLAR_SERVER,
  configured: isPolarConfigured(),
};
