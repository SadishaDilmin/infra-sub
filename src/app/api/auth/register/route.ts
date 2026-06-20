import { withApi } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { authService } from "@/features/auth/auth.service";
import { registerSchema } from "@/features/auth/auth.dto";

export const runtime = "nodejs";

/** POST /api/auth/register — create a customer account + send verification. */
export const POST = withApi(
  async ({ req, ip }) => {
    const body = registerSchema.parse(await readJson(req));
    const user = await authService.register(body, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return created({ user });
  },
  { csrf: false, rateLimit: "AUTH" },
);
