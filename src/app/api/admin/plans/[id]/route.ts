import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { planService } from "@/features/plans/plan.service";
import { updatePlanSchema } from "@/features/plans/plan.dto";
import { ROLES } from "@/config/constants";

export const runtime = "nodejs";

type Params = { id: string };

/** PATCH /api/admin/plans/:id — update a plan. */
export const PATCH = withApi<Params>(
  async ({ req, params, user }) => {
    const body = updatePlanSchema.parse(await readJson(req));
    const plan = await planService.update(params.id, body, {
      id: user!.id,
      email: user!.email,
    });
    return ok({ plan });
  },
  { roles: [ROLES.SUPER_ADMIN] },
);

/** DELETE /api/admin/plans/:id — delete a plan (refused if in use). */
export const DELETE = withApi<Params>(
  async ({ params, user }) => {
    await planService.remove(params.id, { id: user!.id, email: user!.email });
    return ok({ ok: true });
  },
  { roles: [ROLES.SUPER_ADMIN] },
);
