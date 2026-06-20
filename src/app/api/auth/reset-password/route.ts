import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { authService } from "@/features/auth/auth.service";
import { resetPasswordSchema } from "@/features/auth/auth.dto";

export const runtime = "nodejs";

/** POST /api/auth/reset-password — consume reset token, set new password. */
export const POST = withApi(
  async ({ req, ip }) => {
    const body = resetPasswordSchema.parse(await readJson(req));
    await authService.resetPassword(body, { ip });
    return ok({ message: "Password updated. Please log in." });
  },
  { csrf: false, rateLimit: "STRICT" },
);
