import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { userService } from "@/features/users/user.service";
import { updateProfileSchema } from "@/features/users/user.dto";

export const runtime = "nodejs";

/** PATCH /api/profile — update the caller's profile. */
export const PATCH = withApi(
  async ({ req, user, ip }) => {
    const body = updateProfileSchema.parse(await readJson(req));
    const updated = await userService.updateProfile(user!.id, body, { ip });
    return ok({ user: updated });
  },
  { auth: true },
);
