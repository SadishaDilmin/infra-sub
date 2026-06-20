import crypto from "node:crypto";

/**
 * Opaque token helpers for refresh tokens, email-verification, and password
 * reset. We store only a SHA-256 HASH of each token in the DB, never the raw
 * value — so a DB leak cannot be used to mint sessions or reset passwords.
 */

export function generateOpaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison to avoid timing side-channels. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
