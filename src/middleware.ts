import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, ROLES } from "@/config/constants";
import { verifyAccessToken } from "@/lib/auth/jwt";

/**
 * Edge middleware: first-line route protection + redirects.
 *
 * IMPORTANT: this is defence-in-depth, NOT the sole authorization gate. The
 * authoritative checks live in (a) the server-component layouts that call
 * getSessionUser() and re-check DB account state, and (b) every API route via
 * `withApi({ roles })`. Middleware only avoids flashing protected pages to
 * obviously-unauthenticated visitors and steers users to the right place.
 *
 * It uses `jose` (Web Crypto) so it is Edge-runtime compatible — no Node-only
 * imports (mongoose/bcrypt) are pulled into this bundle.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const accessToken = req.cookies.get(AUTH_COOKIE.ACCESS)?.value;
  const refreshToken = req.cookies.get(AUTH_COOKIE.REFRESH)?.value;

  let role: string | null = null;
  let accessValid = false;
  if (accessToken) {
    try {
      const claims = await verifyAccessToken(accessToken);
      role = claims.role;
      accessValid = true;
    } catch {
      accessValid = false;
    }
  }

  // A valid access token OR a refresh token means "probably logged in"; the
  // client/server layout will finalize the session (and refresh if needed).
  const hasSession = accessValid || Boolean(refreshToken);

  const isAdminArea = pathname.startsWith("/admin");
  const isCustomerArea = pathname.startsWith("/dashboard");
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  // Block unauthenticated access to protected areas.
  if ((isAdminArea || isCustomerArea) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // RBAC for admin area when we can read a valid role.
  if (isAdminArea && accessValid && role !== ROLES.SUPER_ADMIN) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Logged-in users shouldn't see auth pages.
  if (isAuthPage && accessValid) {
    const url = req.nextUrl.clone();
    url.pathname = role === ROLES.SUPER_ADMIN ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register", "/forgot-password"],
};
