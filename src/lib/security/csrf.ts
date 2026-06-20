import crypto from "node:crypto";
import { env } from "@/config/env";

/**
 * Stateless CSRF protection using the signed double-submit cookie pattern.
 *
 * - On login/session start we issue a CSRF token in a NON-httpOnly cookie so the
 *   SPA can read it and echo it back in the `x-csrf-token` header.
 * - The token is HMAC-signed with CSRF_SECRET so it cannot be forged.
 * - State-changing requests (POST/PUT/PATCH/DELETE) must present a header token
 *   whose signature is valid. Because a cross-site attacker cannot read the
 *   cookie value (SOP) nor set the custom header, CSRF is mitigated.
 *
 * This works alongside SameSite=strict cookies as defence in depth.
 */

function sign(value: string): string {
  return crypto
    .createHmac("sha256", env.CSRF_SECRET)
    .update(value)
    .digest("base64url");
}

export function issueCsrfToken(): string {
  const random = crypto.randomBytes(24).toString("base64url");
  const signature = sign(random);
  return `${random}.${signature}`;
}

export function verifyCsrfToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [random, signature] = token.split(".");
  if (!random || !signature) return false;
  const expected = sign(random);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
