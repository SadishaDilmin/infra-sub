import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { setAuthCookies } from "@/lib/auth/cookies";
import { authService } from "@/features/auth/auth.service";
import { AUTH_COOKIE } from "@/config/constants";
import { Unauthorized } from "@/lib/errors";

export const runtime = "nodejs";

/** POST /api/auth/refresh — rotate refresh token, issue new session. */
export const POST = withApi(
  async ({ req, ip }) => {
    const rt = req.cookies.get(AUTH_COOKIE.REFRESH)?.value;
    if (!rt) throw Unauthorized("No refresh token");
    const { user, tokens } = await authService.refresh(rt, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await setAuthCookies(tokens);
    return ok({ user, csrfToken: tokens.csrfToken });
  },
  { csrf: false, rateLimit: "AUTH" },
);
