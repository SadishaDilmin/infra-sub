import { cookies } from "next/headers";
import { env } from "@/config/env";
import { AUTH_COOKIE } from "@/config/constants";

/**
 * Auth cookie management.
 *
 * - Access + refresh tokens are httpOnly (JS cannot read them → XSS-resistant).
 * - The CSRF token is intentionally NOT httpOnly so the SPA can echo it back.
 * - SameSite=strict + Secure (in prod) for CSRF defence in depth.
 */

const isProd = env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict" as const,
  path: "/",
};

export async function setAuthCookies(params: {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE.ACCESS, params.accessToken, {
    ...baseCookie,
    maxAge: env.JWT_ACCESS_TTL,
  });
  store.set(AUTH_COOKIE.REFRESH, params.refreshToken, {
    ...baseCookie,
    // Scope the refresh cookie to the refresh endpoint to limit exposure.
    path: "/api/auth",
    maxAge: env.JWT_REFRESH_TTL,
  });
  store.set(AUTH_COOKIE.CSRF, params.csrfToken, {
    ...baseCookie,
    httpOnly: false,
    maxAge: env.JWT_REFRESH_TTL,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE.ACCESS, "", { ...baseCookie, maxAge: 0 });
  store.set(AUTH_COOKIE.REFRESH, "", {
    ...baseCookie,
    path: "/api/auth",
    maxAge: 0,
  });
  store.set(AUTH_COOKIE.CSRF, "", { ...baseCookie, httpOnly: false, maxAge: 0 });
}
