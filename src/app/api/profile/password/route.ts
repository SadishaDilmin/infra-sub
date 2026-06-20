import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { userService } from "@/features/users/user.service";
import { changePasswordSchema } from "@/features/users/user.dto";

export const runtime = "nodejs";

/** POST /api/profile/password — change password (revokes other sessions). */
export const POST = withApi(
  async ({ req, user }) => {
    const body = changePasswordSchema.parse(await readJson(req));
    await userService.changePassword(user!.id, body);
    return ok({ message: "Password changed. Other sessions were signed out." });
  },
  { auth: true },
);
