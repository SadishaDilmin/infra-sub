import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/config/env";
import type { Role } from "@/config/constants";

/**
 * JWT signing/verification using `jose` (Web Crypto based — works in both the
 * Node runtime and the Edge/middleware runtime). Access and refresh tokens use
 * separate secrets so compromise of one does not yield the other.
 */

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export type AccessTokenClaims = JWTPayload & {
  sub: string; // userId
  role: Role;
  email: string;
  type: "access";
};

export type RefreshTokenClaims = JWTPayload & {
  sub: string; // userId
  jti: string; // refresh-token record id (for rotation + reuse detection)
  type: "refresh";
};

export async function signAccessToken(claims: {
  userId: string;
  role: Role;
  email: string;
}): Promise<string> {
  return new SignJWT({ role: claims.role, email: claims.email, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setExpirationTime(`${env.JWT_ACCESS_TTL}s`)
    .sign(accessKey);
}

export async function signRefreshToken(claims: {
  userId: string;
  jti: string;
}): Promise<string> {
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setJti(claims.jti)
    .setIssuedAt()
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setExpirationTime(`${env.JWT_REFRESH_TTL}s`)
    .sign(refreshKey);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, accessKey, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  if (payload.type !== "access") throw new Error("Invalid token type");
  return payload as AccessTokenClaims;
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, refreshKey, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  if (payload.type !== "refresh") throw new Error("Invalid token type");
  return payload as RefreshTokenClaims;
}
