import { addMonths, addYears } from "date-fns";
import type { HydratedDocument } from "mongoose";
import { Subscription, type SubscriptionDoc } from "@/models/subscription.model";
import { Plan, type PlanDoc } from "@/models/plan.model";
import { User } from "@/models/user.model";
import { nextSequence } from "@/models/counter.model";
import {
  buildCheckoutFields,
  payhereConfig,
} from "@/lib/payhere/payhere";
import { cancelPayhereSubscription } from "@/lib/payhere/subscription-manager";
import { createPolarCheckout, cancelPolarSubscription } from "@/lib/polar/polar";
import { env } from "@/config/env";
import { audit, AUDIT_ACTIONS } from "@/lib/audit/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/errors";
import {
  BILLING_INTERVAL,
  PAYMENT_PROVIDER,
  SUBSCRIPTION_STATUS,
  type BillingInterval,
  type PaymentProvider,
} from "@/config/constants";
import type {
  ChangePlanInput,
  CreateSubscriptionInput,
} from "./subscription.dto";

const NON_TERMINAL = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PENDING,
  SUBSCRIPTION_STATUS.PAST_DUE,
];

export type CheckoutResponse = {
  subscriptionId: string;
  orderId: string;
  provider: PaymentProvider;
  // PayHere — hosted form POST (client builds + submits a form).
  actionUrl?: string;
  fields?: Record<string, string>;
  // Polar — hosted checkout (client redirects the browser).
  redirectUrl?: string;
};

function priceForInterval(plan: PlanDoc, interval: BillingInterval): number {
  return interval === BILLING_INTERVAL.YEARLY
    ? plan.yearlyPrice
    : plan.monthlyPrice;
}

function recurrenceForInterval(interval: BillingInterval) {
  return interval === BILLING_INTERVAL.YEARLY
    ? { recurrence: "1 Year", duration: "Forever" }
    : { recurrence: "1 Month", duration: "Forever" };
}

export function computeNextBillingDate(
  from: Date,
  interval: BillingInterval,
): Date {
  return interval === BILLING_INTERVAL.YEARLY
    ? addYears(from, 1)
    : addMonths(from, 1);
}

async function generateOrderId(): Promise<string> {
  const seq = await nextSequence("order");
  // Deterministic, unique, no PII.
  return `ORD-${String(seq).padStart(8, "0")}`;
}

async function getCurrentDoc(
  userId: string,
): Promise<HydratedDocument<SubscriptionDoc> | null> {
  return Subscription.findOne({
    userId,
    status: { $in: NON_TERMINAL },
  });
}

export const subscriptionService = {
  /** Current (non-terminal) subscription for a user, with plan details. */
  async getCurrentForUser(userId: string) {
    const sub = await getCurrentDoc(userId);
    if (!sub) return null;
    const plan = await Plan.findById(sub.planId).lean<PlanDoc>();
    return {
      id: String(sub._id),
      status: sub.status,
      interval: sub.interval,
      amount: sub.amount,
      currency: sub.currency,
      startedAt: sub.startedAt,
      nextBillingDate: sub.nextBillingDate,
      cancelledAt: sub.cancelledAt,
      endedAt: sub.endedAt,
      plan: plan
        ? { id: String(plan._id), name: plan.name, slug: plan.slug, features: plan.features }
        : null,
    };
  },

  async historyForUser(userId: string) {
    const subs = await Subscription.find({ userId })
      .sort({ createdAt: -1 })
      .lean<SubscriptionDoc[]>();
    return subs.map((s) => ({
      id: String(s._id),
      status: s.status,
      interval: s.interval,
      amount: s.amount,
      currency: s.currency,
      startedAt: s.startedAt,
      cancelledAt: s.cancelledAt,
      createdAt: s.createdAt,
    }));
  },

  /**
   * Begin a subscription purchase. Creates (or reuses) a PENDING subscription
   * and returns the PayHere checkout fields. Activation happens later via the
   * verified webhook — never trust the browser return.
   */
  async createCheckout(
    userId: string,
    input: CreateSubscriptionInput,
  ): Promise<CheckoutResponse> {
    const user = await User.findById(userId);
    if (!user) throw NotFound("User not found");

    const plan = await Plan.findById(input.planId);
    if (!plan || !plan.active) throw NotFound("Plan not found or inactive");

    const current = await getCurrentDoc(userId);
    if (
      current &&
      (current.status === SUBSCRIPTION_STATUS.ACTIVE ||
        current.status === SUBSCRIPTION_STATUS.PAST_DUE)
    ) {
      throw Conflict(
        "You already have an active subscription. Use change/upgrade plan instead.",
      );
    }

    const amount = priceForInterval(plan, input.interval);
    const orderId = await generateOrderId();

    // Reuse an existing PENDING subscription (abandoned checkout) to respect the
    // one-active-subscription invariant; otherwise create a new one.
    let sub = current;
    if (sub) {
      sub.planId = plan._id as unknown as SubscriptionDoc["planId"];
      sub.interval = input.interval;
      sub.amount = amount;
      sub.currency = plan.currency;
      sub.checkoutOrderId = orderId;
      await sub.save();
    } else {
      sub = await Subscription.create({
        userId,
        planId: plan._id,
        interval: input.interval,
        amount,
        currency: plan.currency,
        status: SUBSCRIPTION_STATUS.PENDING,
        checkoutOrderId: orderId,
      });
    }

    await audit({
      action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
      actorId: userId,
      actorEmail: user.email,
      targetType: "Subscription",
      targetId: String(sub._id),
      metadata: { planId: input.planId, interval: input.interval, orderId },
    });

    // Polar (Merchant of Record): redirect to a hosted checkout. The plan must
    // be mapped to a Polar product for the chosen interval.
    if (env.PAYMENT_PROVIDER === PAYMENT_PROVIDER.POLAR) {
      const productId =
        input.interval === BILLING_INTERVAL.YEARLY
          ? plan.polarProductIdYearly
          : plan.polarProductIdMonthly;
      if (!productId) {
        throw BadRequest("This plan is not configured for Polar checkout.");
      }
      const checkout = await createPolarCheckout({
        productId,
        successUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?status=success`,
        customer: {
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
        },
        metadata: { subscriptionId: String(sub._id), orderId },
      });
      sub.polarCheckoutId = checkout.id;
      await sub.save();
      return {
        subscriptionId: String(sub._id),
        orderId,
        provider: PAYMENT_PROVIDER.POLAR,
        redirectUrl: checkout.url,
      };
    }

    // PayHere (default): server-computed hash + hosted form POST.
    const fields = buildCheckoutFields({
      orderId,
      amount,
      currency: plan.currency,
      itemDescription: `${plan.name} — ${input.interval.toLowerCase()} subscription`,
      customer: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? "",
      },
      recurrence: recurrenceForInterval(input.interval),
    });

    return {
      subscriptionId: String(sub._id),
      orderId,
      provider: PAYMENT_PROVIDER.PAYHERE,
      actionUrl: payhereConfig.checkoutUrl,
      fields,
    };
  },

  /**
   * Change/upgrade plan. v1 strategy (no proration): cancel the current
   * recurring subscription, then start a fresh checkout for the new plan. The
   * new subscription activates on the next successful webhook.
   */
  async changePlan(userId: string, input: ChangePlanInput) {
    const current = await getCurrentDoc(userId);
    if (!current || current.status === SUBSCRIPTION_STATUS.PENDING) {
      // Nothing active yet — treat as a normal checkout.
      return this.createCheckout(userId, input);
    }
    if (String(current.planId) === input.planId && current.interval === input.interval) {
      throw BadRequest("You are already on this plan.");
    }

    // Cancel the existing recurring subscription (PayHere + local).
    await this.cancel(userId, { reason: "plan_change" });

    await audit({
      action: AUDIT_ACTIONS.SUBSCRIPTION_UPGRADED,
      actorId: userId,
      targetType: "Subscription",
      targetId: String(current._id),
      metadata: { from: String(current.planId), to: input.planId },
    });

    return this.createCheckout(userId, input);
  },

  /** Cancel the current subscription. */
  async cancel(userId: string, opts: { reason?: string } = {}) {
    const sub = await getCurrentDoc(userId);
    if (!sub) throw NotFound("No active subscription to cancel");

    // Cancel with whichever provider holds the recurring token. (Field kept as
    // `payhereNotice` for response back-compat; it carries either provider's note.)
    let payhereNotice: string | undefined;
    if (sub.polarSubscriptionId) {
      const result = await cancelPolarSubscription(sub.polarSubscriptionId);
      if (!result.cancelled) payhereNotice = result.reason;
    } else if (sub.payhereSubscriptionId) {
      const result = await cancelPayhereSubscription(sub.payhereSubscriptionId);
      if (!result.cancelled) payhereNotice = result.reason;
    }

    sub.status = SUBSCRIPTION_STATUS.CANCELLED;
    sub.cancelledAt = new Date();
    // Access continues until the end of the paid period when known.
    sub.endedAt = sub.nextBillingDate ?? new Date();
    await sub.save();

    await audit({
      action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
      actorId: userId,
      targetType: "Subscription",
      targetId: String(sub._id),
      metadata: { reason: opts.reason ?? "user_request", payhereNotice },
    });

    return {
      id: String(sub._id),
      status: sub.status,
      endedAt: sub.endedAt,
      payhereNotice,
    };
  },

  // ----- Called by the webhook pipeline (server-trusted) -----

  /** Locate the subscription a webhook refers to (by PayHere id or order id). */
  async findForWebhook(params: {
    payhereSubscriptionId: string | null;
    orderId: string;
  }): Promise<HydratedDocument<SubscriptionDoc> | null> {
    if (params.payhereSubscriptionId) {
      const byPh = await Subscription.findOne({
        payhereSubscriptionId: params.payhereSubscriptionId,
      });
      if (byPh) return byPh;
    }
    return Subscription.findOne({ checkoutOrderId: params.orderId });
  },

  async activate(
    sub: HydratedDocument<SubscriptionDoc>,
    params: { payhereSubscriptionId: string | null; paidAt: Date },
  ) {
    const now = params.paidAt;
    const isFirstActivation = sub.status !== SUBSCRIPTION_STATUS.ACTIVE;
    sub.status = SUBSCRIPTION_STATUS.ACTIVE;
    if (!sub.startedAt) sub.startedAt = now;
    if (params.payhereSubscriptionId) {
      sub.payhereSubscriptionId = params.payhereSubscriptionId;
    }
    sub.nextBillingDate = computeNextBillingDate(now, sub.interval as BillingInterval);
    await sub.save();

    await audit({
      action: AUDIT_ACTIONS.SUBSCRIPTION_ACTIVATED,
      actorId: String(sub.userId),
      targetType: "Subscription",
      targetId: String(sub._id),
      metadata: { firstActivation: isFirstActivation },
    });
    return sub;
  },

  async markPastDue(sub: HydratedDocument<SubscriptionDoc>) {
    if (sub.status === SUBSCRIPTION_STATUS.ACTIVE) {
      sub.status = SUBSCRIPTION_STATUS.PAST_DUE;
      await sub.save();
    }
    return sub;
  },

  /**
   * Mark a subscription cancelled in response to a provider webhook (the
   * provider has already cancelled on their side, so we don't call it back).
   */
  async markCancelledFromWebhook(
    sub: HydratedDocument<SubscriptionDoc>,
    params: { endedAt: Date },
  ) {
    if (
      sub.status === SUBSCRIPTION_STATUS.CANCELLED ||
      sub.status === SUBSCRIPTION_STATUS.EXPIRED
    ) {
      return sub;
    }
    sub.status = SUBSCRIPTION_STATUS.CANCELLED;
    if (!sub.cancelledAt) sub.cancelledAt = new Date();
    sub.endedAt = params.endedAt;
    await sub.save();
    return sub;
  },
};
