import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { webhookService } from "@/features/payments/webhook.service";
import type { PayhereWebhookPayload } from "@/lib/payhere/payhere";

export const runtime = "nodejs";
// PayHere posts the raw form fields; never cache.
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/payhere — PayHere server-to-server payment notification.
 *
 * Auth model: there are NO cookies here. Authenticity is established by the
 * `md5sig` field (verified in webhookService). CSRF is intentionally disabled
 * (it's a server-to-server call, not a browser form), and the route is public.
 * PayHere sends `application/x-www-form-urlencoded`.
 */
export const POST = withApi(
  async ({ req, ip }) => {
    const form = await req.formData();
    const payload: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      payload[key] = typeof value === "string" ? value : "";
    }
    const result = await webhookService.processNotification(
      payload as unknown as PayhereWebhookPayload,
      { ip },
    );
    // Always 200 for accepted notifications so PayHere stops retrying.
    return ok(result);
  },
  { csrf: false, rateLimit: "WEBHOOK" },
);
