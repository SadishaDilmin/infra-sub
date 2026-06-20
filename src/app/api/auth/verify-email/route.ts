import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { authService } from "@/features/auth/auth.service";
import { verifyEmailSchema } from "@/features/auth/auth.dto";

export const runtime = "nodejs";

/** POST /api/auth/verify-email — confirm email via token, activate account. */
export const POST = withApi(
  async ({ req }) => {
    const body = verifyEmailSchema.parse(await readJson(req));
    const user = await authService.verifyEmail(body.token);
    return ok({ user });
  },
  { csrf: false, rateLimit: "STRICT" },
);
