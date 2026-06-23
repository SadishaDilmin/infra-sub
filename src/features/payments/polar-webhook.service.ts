import type { HydratedDocument } from "mongoose";
import { verifyPolarWebhook } from "@/lib/polar/polar";
import { Plan } from "@/models/plan.model";
import { Subscription, type SubscriptionDoc } from "@/models/subscription.model";
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
 * Processing of Polar webhooks (PAYMENT_PROVIDER=polar). Mirrors the PayHere
 * webhook pipeline: verify signature → resolve subscription → record payment
 * idempotently → run side-effects exactly once. Polar amounts are in minor
 * units (cents); checkout `metadata.subscriptionId` carries our internal id.
 *
 * Polar fires `order.paid` for both the first subscription charge and every
 * renewal — that's the single activation/extension trigger.
 */

type PolarOrder = {
  id: string;
  status?: string;
  amount?: number;
  total_amount?: number;
  currency?: string;
  subscription_id?: string | null;
  metadata?: Record<string, unknown>;
};

type PolarSubscription = {
  id: string;
  status?: string;
  current_period_end?: string | null;
  metadata?: Record<string, unknown>;
};

function metaSubscriptionId(meta: Record<string, unknown> | undefined): string | null {
  const v = meta?.subscriptionId;
  return typeof v === "string" ? v : null;
}

async function resolveSub(
  internalId: string | null,
  polarSubId: string | null,
): Promise<HydratedDocument<SubscriptionDoc> | null> {
  if (internalId) {
    const byId = await Subscription.findById(internalId);
    if (byId) return byId;
  }
  if (polarSubId) {
    return Subscription.findOne({ polarSubscriptionId: polarSubId });
  }
  return null;
}

export const polarWebhookService = {
  async processEvent(
    rawBody: string,
    headers: { id: string | null; timestamp: string | null; signature: string | null },
    ctx: { ip?: string },
  ) {
    let event: { type: string; data: Record<string, unknown> };
    try {
      event = verifyPolarWebhook(rawBody, headers);
    } catch {
      await audit({
        action: AUDIT_ACTIONS.WEBHOOK_REJECTED,
        ip: ctx.ip,
        metadata: { provider: "polar", reason: "bad_signature" },
      });
      throw Forbidden("Invalid webhook signature");
    }

    await audit({
      action: AUDIT_ACTIONS.WEBHOOK_RECEIVED,
      ip: ctx.ip,
      metadata: { provider: "polar", type: event.type },
    });

    switch (event.type) {
      case "order.paid":
        return this.handleOrderPaid(event.data as PolarOrder);
      case "subscription.canceled":
      case "subscription.revoked":
        return this.handleSubscriptionEnded(
          event.data as PolarSubscription,
          event.type,
        );
      default:
        return { ok: true, ignored: event.type };
    }
  },

  async handleOrderPaid(order: PolarOrder) {
    const polarSubId = order.subscription_id ?? null;
    const sub = await resolveSub(metaSubscriptionId(order.metadata), polarSubId);
    if (!sub) {
      logger.warn("Polar order.paid for unknown subscription", {
        orderId: order.id,
        polarSubId,
      });
      return { ok: true, linked: false };
    }

    const cents = order.total_amount ?? order.amount ?? 0;
    const amount = Number(cents) / 100;
    const currency = (order.currency ?? sub.currency ?? "USD").toUpperCase();

    if (polarSubId) sub.polarSubscriptionId = polarSubId;

    const { payment, created } = await paymentService.recordFromWebhook({
      userId: String(sub.userId),
      subscriptionId: String(sub._id),
      payherePaymentId: order.id, // idempotency key = provider order id
      orderId: sub.checkoutOrderId ?? order.id,
      payhereSubscriptionId: polarSubId,
      amount: amount > 0 ? amount : sub.amount,
      currency,
      status: PAYMENT_STATUS.SUCCESS,
      statusCode: order.status ?? "paid",
      paymentDate: new Date(),
      rawPayload: order as Record<string, unknown>,
      paymentMethod: "POLAR",
    });

    if (!created) return { ok: true, duplicate: true };

    await subscriptionService.activate(sub, {
      payhereSubscriptionId: null,
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
      metadata: {
        provider: "polar",
        invoiceNumber: invoice.invoiceNumber,
        amount,
        currency,
      },
    });

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

    return { ok: true, status: "SUCCESS" };
  },

  async handleSubscriptionEnded(data: PolarSubscription, type: string) {
    const sub = await resolveSub(metaSubscriptionId(data.metadata), data.id);
    if (!sub) return { ok: true, linked: false };

    // `revoked` = access ended now; `canceled` = ends at the period end.
    const endedAt =
      type === "subscription.canceled" && data.current_period_end
        ? new Date(data.current_period_end)
        : new Date();
    await subscriptionService.markCancelledFromWebhook(sub, { endedAt });

    await audit({
      action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
      actorId: String(sub.userId),
      targetType: "Subscription",
      targetId: String(sub._id),
      metadata: { provider: "polar", type },
    });
    return { ok: true, status: "CANCELLED" };
  },
};
