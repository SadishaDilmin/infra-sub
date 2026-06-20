import { cookies } from "next/headers";
import { AUTH_COOKIE, type Role } from "@/config/constants";
import { verifyAccessToken } from "@/lib/auth/jwt";

export type SessionUser = {
  id: string;
  role: Role;
  email: string;
};

/**
 * Resolve the current user from the access-token cookie. Returns null when no
 * valid session exists. Safe to call from Server Components and route handlers.
 *
 * Note: this verifies the JWT signature/expiry only. Authorization decisions
 * that depend on live account state (e.g. suspended) should additionally check
 * the DB — see `services` and route guards.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE.ACCESS)?.value;
  if (!token) return null;
  try {
    const claims = await verifyAccessToken(token);
    return { id: claims.sub, role: claims.role, email: claims.email };
  } catch {
    return null;
  }
}
