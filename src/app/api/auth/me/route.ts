import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { userService } from "@/features/users/user.service";

export const runtime = "nodejs";

/** GET /api/auth/me — the authenticated user's profile. */
export const GET = withApi(
  async ({ user }) => {
    const profile = await userService.getProfile(user!.id);
    return ok({ user: profile });
  },
  { auth: true },
);
