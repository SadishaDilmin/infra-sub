import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { polarWebhookService } from "@/features/payments/polar-webhook.service";

export const runtime = "nodejs";
// Polar posts a signed JSON body; never cache, and we need the RAW body for
// signature verification.
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/polar — Polar server-to-server webhook.
 *
 * Auth model mirrors the PayHere webhook: no cookies, authenticity is the
 * Standard Webhooks signature (verified in polarWebhookService). CSRF off
 * (server-to-server), public route.
 */
export const POST = withApi(
  async ({ req, ip }) => {
    const raw = await req.text();
    const result = await polarWebhookService.processEvent(
      raw,
      {
        id: req.headers.get("webhook-id"),
        timestamp: req.headers.get("webhook-timestamp"),
        signature: req.headers.get("webhook-signature"),
      },
      { ip },
    );
    // Always 200 for accepted events so Polar stops retrying.
    return ok(result);
  },
  { csrf: false, rateLimit: "WEBHOOK" },
);
