import { env } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * PayHere Subscription Manager API client — used to cancel recurring
 * subscriptions server-side. It uses OAuth2 client-credentials with the PayHere
 * "Business App" id/secret (distinct from the merchant secret used for hashing).
 *
 * If app credentials are not configured we return `{ cancelled: false }` so the
 * caller can still mark the local subscription cancelled and surface a notice.
 * This keeps the product usable in sandbox/local without the Business App.
 */

export function isSubscriptionApiConfigured(): boolean {
  return Boolean(env.PAYHERE_APP_ID && env.PAYHERE_APP_SECRET);
}

async function getAccessToken(): Promise<string | null> {
  if (!isSubscriptionApiConfigured()) return null;
  const basic = Buffer.from(
    `${env.PAYHERE_APP_ID}:${env.PAYHERE_APP_SECRET}`,
  ).toString("base64");
  const res = await fetch(`${env.PAYHERE_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    logger.error("PayHere OAuth token request failed", { status: res.status });
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

export async function cancelPayhereSubscription(
  payhereSubscriptionId: string,
): Promise<{ cancelled: boolean; reason?: string }> {
  if (!isSubscriptionApiConfigured()) {
    return {
      cancelled: false,
      reason:
        "PayHere Business App credentials not configured; cancelled locally only.",
    };
  }
  try {
    const token = await getAccessToken();
    if (!token) return { cancelled: false, reason: "Could not obtain token" };

    const res = await fetch(`${env.PAYHERE_API_BASE}/subscription/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription_id: payhereSubscriptionId }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { status?: number; msg?: string };
    if (res.ok && json.status === 1) return { cancelled: true };
    return { cancelled: false, reason: json.msg ?? `HTTP ${res.status}` };
  } catch (err) {
    logger.error("PayHere subscription cancel failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { cancelled: false, reason: "Request error" };
  }
}
