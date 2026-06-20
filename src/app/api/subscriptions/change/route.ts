import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { subscriptionService } from "@/features/subscriptions/subscription.service";
import { changePlanSchema } from "@/features/subscriptions/subscription.dto";

export const runtime = "nodejs";

/** POST /api/subscriptions/change — upgrade/downgrade plan (returns new checkout). */
export const POST = withApi(
  async ({ req, user }) => {
    const body = changePlanSchema.parse(await readJson(req));
    const checkout = await subscriptionService.changePlan(user!.id, body);
    return ok({ checkout });
  },
  { auth: true },
);
