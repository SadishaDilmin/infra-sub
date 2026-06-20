import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { setAuthCookies } from "@/lib/auth/cookies";
import { authService } from "@/features/auth/auth.service";
import { loginSchema } from "@/features/auth/auth.dto";

export const runtime = "nodejs";

/** POST /api/auth/login — verify credentials, issue session cookies. */
export const POST = withApi(
  async ({ req, ip }) => {
    const body = loginSchema.parse(await readJson(req));
    const { user, tokens } = await authService.login(body, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await setAuthCookies(tokens);
    return ok({ user, csrfToken: tokens.csrfToken });
  },
  { csrf: false, rateLimit: "AUTH" },
);
