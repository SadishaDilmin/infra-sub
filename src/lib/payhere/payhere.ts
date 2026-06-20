import crypto from "node:crypto";
import { env } from "@/config/env";

/**
 * PayHere (https://www.payhere.lk) integration helpers.
 *
 * PayHere uses a redirect/checkout model: we render a form (or POST) to the
 * PayHere checkout URL with a server-computed MD5 `hash`. PayHere then calls our
 * `notify_url` (server-to-server webhook) with the authoritative payment result,
 * signed with `md5sig`. We treat the WEBHOOK as the source of truth — never the
 * browser `return_url`, which the user controls.
 *
 * Signature specs (per PayHere docs):
 *   checkout hash = UPPER( md5( merchant_id + order_id + amount + currency
 *                               + UPPER(md5(merchant_secret)) ) )
 *   notify md5sig = UPPER( md5( merchant_id + order_id + payhere_amount
 *                               + payhere_currency + status_code
 *                               + UPPER(md5(merchant_secret)) ) )
 */

function md5Upper(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex").toUpperCase();
}

/** PayHere expects the amount as a fixed 2-decimal string with no separators. */
export function formatPayhereAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

export function generateCheckoutHash(params: {
  orderId: string;
  amount: number;
  currency: string;
}): string {
  const secretHash = md5Upper(env.PAYHERE_MERCHANT_SECRET);
  return md5Upper(
    env.PAYHERE_MERCHANT_ID +
      params.orderId +
      formatPayhereAmount(params.amount) +
      params.currency +
      secretHash,
  );
}

export type PayhereWebhookPayload = {
  merchant_id: string;
  order_id: string;
  payment_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
  md5sig: string;
  // Recurring-only fields (present for subscription notifications):
  subscription_id?: string;
  recurring?: string;
  item_recurring_status?: string;
  // Card metadata PayHere may include:
  method?: string;
  card_holder_name?: string;
  card_no?: string; // masked
  [key: string]: string | undefined;
};

/** Verify the md5sig sent by PayHere on the notify webhook. */
export function verifyWebhookSignature(payload: PayhereWebhookPayload): boolean {
  const secretHash = md5Upper(env.PAYHERE_MERCHANT_SECRET);
  const local = md5Upper(
    payload.merchant_id +
      payload.order_id +
      payload.payhere_amount +
      payload.payhere_currency +
      payload.status_code +
      secretHash,
  );
  const a = Buffer.from(local);
  const b = Buffer.from((payload.md5sig ?? "").toUpperCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type CheckoutCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
};

export type CheckoutRecurrence = {
  /** e.g. "1 Month" | "1 Year" — how often PayHere charges the card. */
  recurrence: string;
  /** e.g. "Forever" | "1 Year" — how long the subscription continues. */
  duration: string;
};

/**
 * Build the full set of form fields to submit to the PayHere checkout. The
 * client renders these as a hidden auto-submitting form (see PayHereCheckout).
 */
export function buildCheckoutFields(params: {
  orderId: string;
  amount: number;
  currency?: string;
  itemDescription: string;
  customer: CheckoutCustomer;
  recurrence?: CheckoutRecurrence;
}): Record<string, string> {
  const currency = params.currency ?? env.PAYHERE_CURRENCY;
  const fields: Record<string, string> = {
    merchant_id: env.PAYHERE_MERCHANT_ID,
    return_url: env.PAYHERE_RETURN_URL,
    cancel_url: env.PAYHERE_CANCEL_URL,
    notify_url: env.PAYHERE_NOTIFY_URL,
    order_id: params.orderId,
    items: params.itemDescription,
    currency,
    amount: formatPayhereAmount(params.amount),
    first_name: params.customer.firstName,
    last_name: params.customer.lastName,
    email: params.customer.email,
    phone: params.customer.phone ?? "",
    address: params.customer.address ?? "",
    city: params.customer.city ?? "",
    country: params.customer.country ?? "Sri Lanka",
    hash: generateCheckoutHash({
      orderId: params.orderId,
      amount: params.amount,
      currency,
    }),
  };

  if (params.recurrence) {
    fields.recurrence = params.recurrence.recurrence;
    fields.duration = params.recurrence.duration;
  }

  return fields;
}

export function mapStatusCode(statusCode: string): {
  payment: "SUCCESS" | "PENDING" | "FAILED" | "CHARGEBACK";
} {
  switch (statusCode) {
    case "2":
      return { payment: "SUCCESS" };
    case "0":
      return { payment: "PENDING" };
    case "-3":
      return { payment: "CHARGEBACK" };
    default:
      return { payment: "FAILED" }; // -1 cancelled, -2 failed
  }
}

export const payhereConfig = {
  checkoutUrl: env.PAYHERE_CHECKOUT_URL,
  mode: env.PAYHERE_MODE,
  currency: env.PAYHERE_CURRENCY,
  merchantId: env.PAYHERE_MERCHANT_ID,
};
