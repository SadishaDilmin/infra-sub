import {
  verifyWebhookSignature,
  mapStatusCode,
  type PayhereWebhookPayload,
} from "@/lib/payhere/payhere";
import { Plan } from "@/models/plan.model";
import { PAYMENT_STATUS } from "@/config/constants";
import { paymentService } from "./payment.service";
import { subscriptionService } from "@/features/subscriptions/subscription.service";
import { invoiceService } from "@/features/invoices/invoice.service";
import { sendEmail } from "@/lib/email/email";
import { paymentReceiptTemplate } from "@/lib/email/templates";
import { audit, AUDIT_ACTIONS } from "@/lib/audit/audit";
import { formatCurrency } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Forbidden } from "@/lib/errors";

/**
 * End-to-end processing of a PayHere `notify_url` webhook. This is the ONLY
 * place subscriptions get activated and invoices get created, because it is the
 * only server-trusted, signature-verified source of payment truth.
 *
 * Idempotency is layered:
 *  - Signature verification rejects forged/replayed-with-tampering calls.
 *  - Payment insert is keyed on the unique PayHere payment_id, so retried
 *    webhooks never double-record or double-activate (we gate side-effects on
 *    `created`).
 */
export const webhookService = {
  async processNotification(
    payload: PayhereWebhookPayload,
    ctx: { ip?: string },
  ) {
    // 1. Verify md5sig — this is non-negotiable.
    if (!verifyWebhookSignature(payload)) {
      await audit({
        action: AUDIT_ACTIONS.WEBHOOK_REJECTED,
        ip: ctx.ip,
        metadata: { orderId: payload.order_id, reason: "bad_signature" },
      });
      throw Forbidden("Invalid webhook signature");
    }

    await audit({
      action: AUDIT_ACTIONS.WEBHOOK_RECEIVED,
      ip: ctx.ip,
      metadata: {
        orderId: payload.order_id,
        paymentId: payload.payment_id,
        statusCode: payload.status_code,
      },
    });

    const { payment: paymentStatus } = mapStatusCode(payload.status_code);
    const phSubId = payload.subscription_id ?? null;

    // 2. Resolve the subscription (and therefore the owning user).
    const sub = await subscriptionService.findForWebhook({
      payhereSubscriptionId: phSubId,
      orderId: payload.order_id,
    });
    if (!sub) {
      logger.warn("Webhook for unknown subscription/order", {
        orderId: payload.order_id,
        phSubId,
      });
      // Acknowledge to stop retries; nothing to link to.
      return { ok: true, linked: false };
    }

    const amount = Number(payload.payhere_amount);
    const currency = payload.payhere_currency || sub.currency;

    // 3. Record the payment idempotently.
    const { payment, created } = await paymentService.recordFromWebhook({
      userId: String(sub.userId),
      subscriptionId: String(sub._id),
      payherePaymentId: payload.payment_id,
      orderId: payload.order_id,
      payhereSubscriptionId: phSubId,
      amount: Number.isFinite(amount) ? amount : sub.amount,
      currency,
      status:
        paymentStatus === "SUCCESS"
          ? PAYMENT_STATUS.SUCCESS
          : paymentStatus === "PENDING"
            ? PAYMENT_STATUS.PENDING
            : paymentStatus === "CHARGEBACK"
              ? PAYMENT_STATUS.CHARGEBACK
              : PAYMENT_STATUS.FAILED,
      statusCode: payload.status_code,
      paymentDate: new Date(),
      rawPayload: payload as Record<string, unknown>,
    });

    // 4. Side-effects run exactly once (only for a newly recorded payment).
    if (!created) {
      logger.info("Duplicate webhook ignored", {
        paymentId: payload.payment_id,
      });
      return { ok: true, duplicate: true };
    }

    if (paymentStatus === "SUCCESS") {
      await subscriptionService.activate(sub, {
        payhereSubscriptionId: phSubId,
        paidAt: payment.paymentDate as Date,
      });

      const plan = await Plan.findById(sub.planId).lean();
      const planName = plan?.name ?? "Subscription";
      const invoice = await invoiceService.createForPayment(payment, { planName });

      await audit({
        action: AUDIT_ACTIONS.PAYMENT_RECORDED,
        actorId: String(sub.userId),
        targetType: "Payment",
        targetId: String(payment._id),
        metadata: { invoiceNumber: invoice.invoiceNumber, amount, currency },
      });

      // Best-effort receipt.
      try {
        const { User } = await import("@/models/user.model");
        const user = await User.findById(sub.userId).lean();
        if (user?.email) {
          const { subject, html } = paymentReceiptTemplate({
            invoiceNumber: invoice.invoiceNumber,
            amount: formatCurrency(amount, currency),
            planName,
          });
          await sendEmail({ to: user.email, subject, html });
        }
      } catch (err) {
        logger.error("Failed to send receipt email", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (paymentStatus === "FAILED" || paymentStatus === "CHARGEBACK") {
      // Recurring charge failed → mark subscription past due.
      await subscriptionService.markPastDue(sub);
      await audit({
        action: AUDIT_ACTIONS.PAYMENT_FAILED,
        actorId: String(sub.userId),
        targetType: "Subscription",
        targetId: String(sub._id),
        metadata: { statusCode: payload.status_code },
      });
    }

    return { ok: true, status: paymentStatus };
  },
};
