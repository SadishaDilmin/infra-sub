import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { authService } from "@/features/auth/auth.service";
import { forgotPasswordSchema } from "@/features/auth/auth.dto";

export const runtime = "nodejs";

/** POST /api/auth/forgot-password — always returns ok (no user enumeration). */
export const POST = withApi(
  async ({ req, ip }) => {
    const body = forgotPasswordSchema.parse(await readJson(req));
    await authService.forgotPassword(body, { ip });
    return ok({ message: "If that email exists, a reset link has been sent." });
  },
  { csrf: false, rateLimit: "STRICT" },
);
