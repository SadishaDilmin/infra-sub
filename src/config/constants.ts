/**
 * Domain enums and constants shared across server and client.
 * Keep this file free of server-only imports so it is safe in both runtimes.
 */

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CUSTOMER: "CUSTOMER",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING: "PENDING", // awaiting email verification
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const BILLING_INTERVAL = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;
export type BillingInterval =
  (typeof BILLING_INTERVAL)[keyof typeof BILLING_INTERVAL];

export const SUBSCRIPTION_STATUS = {
  PENDING: "PENDING", // created, awaiting first successful payment
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE", // a recurring payment failed
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CHARGEBACK: "CHARGEBACK",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  PAID: "PAID",
  UNPAID: "UNPAID",
  VOID: "VOID",
} as const;
export type InvoiceStatus =
  (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const VERIFICATION_TOKEN_TYPE = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
} as const;
export type VerificationTokenType =
  (typeof VERIFICATION_TOKEN_TYPE)[keyof typeof VERIFICATION_TOKEN_TYPE];

/**
 * PayHere `status_code` values returned on the notify_url webhook.
 *   2  = success, 0 = pending, -1 = cancelled, -2 = failed, -3 = chargeback
 */
export const PAYHERE_STATUS_CODE = {
  SUCCESS: "2",
  PENDING: "0",
  CANCELLED: "-1",
  FAILED: "-2",
  CHARGEBACK: "-3",
} as const;

export const AUTH_COOKIE = {
  ACCESS: "isub_at",
  REFRESH: "isub_rt",
  CSRF: "isub_csrf",
} as const;

/** Default VAT/sales-tax rate used when generating invoices (Sri Lanka VAT example). */
export const DEFAULT_TAX_RATE = 0; // set per your jurisdiction; 0 by default.
