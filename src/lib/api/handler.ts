import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { fail } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/api/request";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { verifyCsrfToken } from "@/lib/security/csrf";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE, ROLES, type Role } from "@/config/constants";
import { Forbidden, Unauthorized } from "@/lib/errors";

export type ApiUser = { id: string; role: Role; email: string };

export type ApiContext<P = Record<string, string>> = {
  req: NextRequest;
  params: P;
  ip: string;
  user: ApiUser | null;
};

type RouteHandler<P> = (ctx: ApiContext<P>) => Promise<NextResponse> | NextResponse;

export type WithApiOptions = {
  /** Require a valid session. */
  auth?: boolean;
  /** Restrict to specific roles (implies auth). */
  roles?: Role[];
  /** Enforce CSRF token on mutating methods. Default true for mutations. */
  csrf?: boolean;
  /** Rate-limit preset key or explicit config. */
  rateLimit?: keyof typeof RATE_LIMITS | { limit: number; windowMs: number } | false;
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Central wrapper for every API route. Responsibilities (cross-cutting concerns
 * kept out of business logic — SOLID/Separation of Concerns):
 *   1. Ensure the DB is connected.
 *   2. Rate limit by IP (+ user when authenticated).
 *   3. Verify CSRF on state-changing requests.
 *   4. Authenticate + authorize (RBAC) when required.
 *   5. Map thrown AppError / ZodError to a consistent JSON envelope.
 */
export function withApi<P = Record<string, string>>(
  handler: RouteHandler<P>,
  options: WithApiOptions = {},
) {
  return async (
    req: NextRequest,
    context: { params: Promise<P> },
  ): Promise<NextResponse> => {
    const ip = getClientIp(req);
    try {
      await connectDB();

      // 1. Rate limiting
      if (options.rateLimit !== false) {
        const cfg =
          typeof options.rateLimit === "object"
            ? options.rateLimit
            : RATE_LIMITS[options.rateLimit ?? "API"];
        await enforceRateLimit(`${req.nextUrl.pathname}:${ip}`, cfg);
      }

      // 2. CSRF for mutations (default on)
      const csrfRequired = options.csrf ?? MUTATING.has(req.method);
      if (csrfRequired && MUTATING.has(req.method)) {
        const headerToken = req.headers.get("x-csrf-token");
        const cookieToken = req.cookies.get(AUTH_COOKIE.CSRF)?.value;
        if (
          !headerToken ||
          headerToken !== cookieToken ||
          !verifyCsrfToken(headerToken)
        ) {
          throw Forbidden("Invalid or missing CSRF token");
        }
      }

      // 3. Authn/Authz
      let user: ApiUser | null = null;
      const needsAuth = options.auth || (options.roles?.length ?? 0) > 0;
      const token = req.cookies.get(AUTH_COOKIE.ACCESS)?.value;
      if (token) {
        try {
          const claims = await verifyAccessToken(token);
          user = { id: claims.sub, role: claims.role, email: claims.email };
        } catch {
          user = null;
        }
      }
      if (needsAuth && !user) throw Unauthorized();
      if (options.roles?.length && (!user || !options.roles.includes(user.role))) {
        throw Forbidden();
      }

      const params = await context.params;
      return await handler({ req, params, ip, user });
    } catch (err) {
      return mapError(err, ip, req);
    }
  };
}

function mapError(err: unknown, ip: string, req: NextRequest): NextResponse {
  if (err instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Validation failed", 422, err.flatten());
  }
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, ip, path: req.nextUrl.pathname });
    }
    return fail(
      err.code,
      err.expose ? err.message : "Something went wrong",
      err.statusCode,
      err.expose ? err.details : undefined,
    );
  }
  logger.error("Unhandled error", {
    error: err instanceof Error ? err.message : String(err),
    ip,
    path: req.nextUrl.pathname,
  });
  return fail("INTERNAL", "Internal server error", 500);
}

export { ROLES };
