import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { planService } from "@/features/plans/plan.service";

export const runtime = "nodejs";

/** GET /api/plans — public list of active plans (pricing page). */
export const GET = withApi(async () => {
  const plans = await planService.listPublic();
  return ok({ plans });
});
