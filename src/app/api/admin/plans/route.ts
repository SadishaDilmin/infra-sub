import { withApi } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { planService } from "@/features/plans/plan.service";
import { createPlanSchema } from "@/features/plans/plan.dto";
import { ROLES } from "@/config/constants";

export const runtime = "nodejs";

/** GET /api/admin/plans — all plans (admin). */
export const GET = withApi(
  async () => ok({ plans: await planService.listAll() }),
  { roles: [ROLES.SUPER_ADMIN] },
);

/** POST /api/admin/plans — create a plan (admin). */
export const POST = withApi(
  async ({ req, user }) => {
    const body = createPlanSchema.parse(await readJson(req));
    const plan = await planService.create(body, {
      id: user!.id,
      email: user!.email,
    });
    return created({ plan });
  },
  { roles: [ROLES.SUPER_ADMIN] },
);
