import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { authService } from "@/features/auth/auth.service";
import { forgotPasswordSchema } from "@/features/auth/auth.dto";

export const runtime = "nodejs";

/** POST /api/auth/resend-verification — re-send the email verification link. */
export const POST = withApi(
  async ({ req }) => {
    const body = forgotPasswordSchema.parse(await readJson(req));
    await authService.resendVerification(body.email);
    return ok({ message: "If unverified, a new link has been sent." });
  },
  { csrf: false, rateLimit: "STRICT" },
);
