import { AuditLog } from "@/models/audit-log.model";
import { logger } from "@/lib/logger";

/**
 * Append an audit-log entry. Best-effort: audit failures are logged but never
 * block the primary operation. Audit records are append-only (see model docs).
 */

export const AUDIT_ACTIONS = {
  USER_REGISTERED: "USER_REGISTERED",
  USER_LOGIN: "USER_LOGIN",
  USER_LOGIN_FAILED: "USER_LOGIN_FAILED",
  USER_LOGOUT: "USER_LOGOUT",
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET: "PASSWORD_RESET",
  TOKEN_REFRESHED: "TOKEN_REFRESHED",
  TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  PLAN_CREATED: "PLAN_CREATED",
  PLAN_UPDATED: "PLAN_UPDATED",
  PLAN_DELETED: "PLAN_DELETED",
  SUBSCRIPTION_CREATED: "SUBSCRIPTION_CREATED",
  SUBSCRIPTION_ACTIVATED: "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_UPGRADED: "SUBSCRIPTION_UPGRADED",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_CANCELLED",
  PAYMENT_RECORDED: "PAYMENT_RECORDED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  WEBHOOK_RECEIVED: "WEBHOOK_RECEIVED",
  WEBHOOK_REJECTED: "WEBHOOK_REJECTED",
  CUSTOMER_SUSPENDED: "CUSTOMER_SUSPENDED",
  CUSTOMER_REACTIVATED: "CUSTOMER_REACTIVATED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export async function audit(entry: {
  action: AuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AuditLog.create({
      action: entry.action,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    logger.error("Failed to write audit log", {
      action: entry.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
