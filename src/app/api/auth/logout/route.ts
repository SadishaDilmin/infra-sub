import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { authService } from "@/features/auth/auth.service";
import { AUTH_COOKIE } from "@/config/constants";

export const runtime = "nodejs";

/** POST /api/auth/logout — revoke refresh-token family, clear cookies. */
export const POST = withApi(
  async ({ req, ip }) => {
    const rt = req.cookies.get(AUTH_COOKIE.REFRESH)?.value;
    await authService.logout(rt, { ip });
    await clearAuthCookies();
    return ok({ ok: true });
  },
  { csrf: false },
);
