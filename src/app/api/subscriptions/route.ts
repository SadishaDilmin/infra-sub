import { withApi } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { subscriptionService } from "@/features/subscriptions/subscription.service";
import { createSubscriptionSchema } from "@/features/subscriptions/subscription.dto";

export const runtime = "nodejs";

/** GET /api/subscriptions — the caller's current subscription. */
export const GET = withApi(
  async ({ user }) => {
    const subscription = await subscriptionService.getCurrentForUser(user!.id);
    return ok({ subscription });
  },
  { auth: true },
);

/** POST /api/subscriptions — start a checkout for a plan (returns PayHere fields). */
export const POST = withApi(
  async ({ req, user }) => {
    const body = createSubscriptionSchema.parse(await readJson(req));
    const checkout = await subscriptionService.createCheckout(user!.id, body);
    return created({ checkout });
  },
  { auth: true },
);
