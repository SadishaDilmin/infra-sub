import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { subscriptionService } from "@/features/subscriptions/subscription.service";

export const runtime = "nodejs";

/** POST /api/subscriptions/cancel — cancel the caller's subscription. */
export const POST = withApi(
  async ({ user }) => {
    const result = await subscriptionService.cancel(user!.id);
    return ok({ subscription: result });
  },
  { auth: true },
);
