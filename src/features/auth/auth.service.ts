import { User, type UserDoc } from "@/models/user.model";
import { RefreshToken } from "@/models/refresh-token.model";
import { VerificationToken } from "@/models/verification-token.model";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { generateOpaqueToken, sha256 } from "@/lib/auth/tokens";
import { issueCsrfToken } from "@/lib/security/csrf";
import { sendEmail } from "@/lib/email/email";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/lib/email/templates";
import { audit, AUDIT_ACTIONS } from "@/lib/audit/audit";
import { env } from "@/config/env";
import {
  ROLES,
  USER_STATUS,
  VERIFICATION_TOKEN_TYPE,
  type Role,
} from "@/config/constants";
import { Conflict, Forbidden, Unauthorized, BadRequest } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.dto";

export type RequestCtx = { ip?: string; userAgent?: string };

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

export function serializeUser(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role as Role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt as Date,
  };
}

/**
 * Create a session: persist a hashed refresh token (for rotation/reuse
 * detection) and return the signed access+refresh tokens plus a CSRF token.
 * The route handler is responsible for writing these to httpOnly cookies.
 */
async function issueSession(
  user: UserDoc,
  ctx: RequestCtx,
  familyId?: string,
): Promise<SessionTokens> {
  const family = familyId ?? generateOpaqueToken(16);
  const refreshToken = await signRefreshToken({
    userId: String(user._id),
    jti: family,
  });
  await RefreshToken.create({
    userId: user._id,
    familyId: family,
    tokenHash: sha256(refreshToken),
    userAgent: ctx.userAgent ?? "",
    ip: ctx.ip ?? "",
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL * 1000),
  });

  const accessToken = await signAccessToken({
    userId: String(user._id),
    role: user.role as Role,
    email: user.email,
  });

  return { accessToken, refreshToken, csrfToken: issueCsrfToken() };
}

async function createAndSendVerification(user: UserDoc): Promise<void> {
  const raw = generateOpaqueToken();
  await VerificationToken.create({
    userId: user._id,
    type: VERIFICATION_TOKEN_TYPE.EMAIL_VERIFICATION,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });
  const { subject, html } = verifyEmailTemplate(raw);
  await sendEmail({ to: user.email, subject, html });
}

export const authService = {
  async register(input: RegisterInput, ctx: RequestCtx) {
    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) throw Conflict("An account with this email already exists");

    const passwordHash = await hashPassword(input.password);
    const user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: passwordHash,
      role: ROLES.CUSTOMER,
      status: USER_STATUS.PENDING,
    });

    await createAndSendVerification(user);
    await audit({
      action: AUDIT_ACTIONS.USER_REGISTERED,
      actorId: String(user._id),
      actorEmail: user.email,
      targetType: "User",
      targetId: String(user._id),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return serializeUser(user);
  },

  async login(input: LoginInput, ctx: RequestCtx) {
    // +password to compare; generic error to prevent user enumeration.
    const user = await User.findOne({ email: input.email }).select("+password");
    if (!user) {
      await audit({
        action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
        actorEmail: input.email,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { reason: "no_such_user" },
      });
      throw Unauthorized("Invalid email or password");
    }

    const valid = await verifyPassword(input.password, user.password);
    if (!valid) {
      await audit({
        action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
        actorId: String(user._id),
        actorEmail: user.email,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { reason: "bad_password" },
      });
      throw Unauthorized("Invalid email or password");
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      throw Forbidden("Your account has been suspended. Contact support.");
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await issueSession(user, ctx);
    await audit({
      action: AUDIT_ACTIONS.USER_LOGIN,
      actorId: String(user._id),
      actorEmail: user.email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user: serializeUser(user), tokens };
  },

  /**
   * Rotate a refresh token. Implements reuse detection: if a token that was
   * already rotated (revoked) is presented again, the whole family is revoked.
   */
  async refresh(refreshToken: string, ctx: RequestCtx) {
    let claims;
    try {
      claims = await verifyRefreshToken(refreshToken);
    } catch {
      throw Unauthorized("Invalid refresh token");
    }

    const tokenHash = sha256(refreshToken);
    const record = await RefreshToken.findOne({ tokenHash });

    if (!record) {
      // Unknown but signature-valid token → treat as compromised family.
      await RefreshToken.updateMany(
        { familyId: claims.jti },
        { $set: { revoked: true, revokedAt: new Date() } },
      );
      await audit({
        action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
        actorId: claims.sub,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { familyId: claims.jti, reason: "unknown_token" },
      });
      throw Unauthorized("Session expired, please log in again");
    }

    if (record.revoked) {
      // Reuse of a rotated token → revoke entire family.
      await RefreshToken.updateMany(
        { familyId: record.familyId },
        { $set: { revoked: true, revokedAt: new Date() } },
      );
      await audit({
        action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
        actorId: String(record.userId),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { familyId: record.familyId, reason: "reuse" },
      });
      throw Unauthorized("Session expired, please log in again");
    }

    const user = await User.findById(record.userId);
    if (!user || user.status === USER_STATUS.SUSPENDED) {
      throw Unauthorized("Session is no longer valid");
    }

    // Rotate: issue a new token in the same family, revoke the old one.
    const newTokens = await issueSession(user, ctx, record.familyId);
    record.revoked = true;
    record.revokedAt = new Date();
    record.replacedByHash = sha256(newTokens.refreshToken);
    await record.save();

    await audit({
      action: AUDIT_ACTIONS.TOKEN_REFRESHED,
      actorId: String(user._id),
      actorEmail: user.email,
      ip: ctx.ip,
    });

    return { user: serializeUser(user), tokens: newTokens };
  },

  async logout(refreshToken: string | undefined, ctx: RequestCtx) {
    if (!refreshToken) return;
    const record = await RefreshToken.findOne({ tokenHash: sha256(refreshToken) });
    if (record) {
      await RefreshToken.updateMany(
        { familyId: record.familyId },
        { $set: { revoked: true, revokedAt: new Date() } },
      );
      await audit({
        action: AUDIT_ACTIONS.USER_LOGOUT,
        actorId: String(record.userId),
        ip: ctx.ip,
      });
    }
  },

  async verifyEmail(token: string) {
    const record = await VerificationToken.findOne({
      tokenHash: sha256(token),
      type: VERIFICATION_TOKEN_TYPE.EMAIL_VERIFICATION,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!record) throw BadRequest("Invalid or expired verification link");

    const user = await User.findById(record.userId);
    if (!user) throw BadRequest("Invalid verification link");

    user.emailVerifiedAt = new Date();
    if (user.status === USER_STATUS.PENDING) user.status = USER_STATUS.ACTIVE;
    await user.save();

    record.consumedAt = new Date();
    await record.save();

    await audit({
      action: AUDIT_ACTIONS.EMAIL_VERIFIED,
      actorId: String(user._id),
      actorEmail: user.email,
    });

    return serializeUser(user);
  },

  async forgotPassword(input: ForgotPasswordInput, ctx: RequestCtx) {
    const user = await User.findOne({ email: input.email });
    // Always behave identically to avoid leaking which emails exist.
    if (user) {
      const raw = generateOpaqueToken();
      await VerificationToken.create({
        userId: user._id,
        type: VERIFICATION_TOKEN_TYPE.PASSWORD_RESET,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      });
      const { subject, html } = resetPasswordTemplate(raw);
      await sendEmail({ to: user.email, subject, html });
      await audit({
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        actorId: String(user._id),
        actorEmail: user.email,
        ip: ctx.ip,
      });
    } else {
      logger.info("Password reset requested for unknown email", {
        email: input.email,
      });
    }
    return { ok: true };
  },

  async resetPassword(input: ResetPasswordInput, ctx: RequestCtx) {
    const record = await VerificationToken.findOne({
      tokenHash: sha256(input.token),
      type: VERIFICATION_TOKEN_TYPE.PASSWORD_RESET,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!record) throw BadRequest("Invalid or expired reset link");

    const user = await User.findById(record.userId);
    if (!user) throw BadRequest("Invalid reset link");

    user.password = await hashPassword(input.password);
    user.tokenVersion += 1;
    await user.save();

    record.consumedAt = new Date();
    await record.save();

    // Invalidate all existing sessions on password change.
    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
    );

    await audit({
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      actorId: String(user._id),
      actorEmail: user.email,
      ip: ctx.ip,
    });

    return { ok: true };
  },

  async resendVerification(email: string) {
    const user = await User.findOne({ email });
    if (user && !user.emailVerifiedAt) {
      await createAndSendVerification(user);
    }
    return { ok: true };
  },
};
