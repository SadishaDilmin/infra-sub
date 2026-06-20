import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { userService } from "@/features/users/user.service";
import { adminUpdateUserStatusSchema } from "@/features/users/user.dto";
import { ROLES } from "@/config/constants";

export const runtime = "nodejs";

type Params = { id: string };

/** PATCH /api/admin/customers/:id/status — suspend or reactivate a customer. */
export const PATCH = withApi<Params>(
  async ({ req, params, user, ip }) => {
    const body = adminUpdateUserStatusSchema.parse(await readJson(req));
    const updated = await userService.setStatus(params.id, body.action, {
      id: user!.id,
      email: user!.email,
      ip,
    });
    return ok({ user: updated });
  },
  { roles: [ROLES.SUPER_ADMIN] },
);
