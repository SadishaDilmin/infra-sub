import { Payment, type PaymentDoc } from "@/models/payment.model";
import { PAYMENT_STATUS, type PaymentStatus } from "@/config/constants";

export type PublicPayment = {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  status: string;
  paymentDate: Date;
};

function serializePayment(p: PaymentDoc): PublicPayment {
  return {
    id: String(p._id),
    amount: p.amount,
    currency: p.currency,
    paymentMethod: p.paymentMethod,
    transactionId: p.transactionId,
    status: p.status,
    paymentDate: p.paymentDate as Date,
  };
}

export const paymentService = {
  /**
   * Idempotently record a payment from a verified PayHere webhook.
   *
   * The unique index on `payherePaymentId` is the safety net: if PayHere retries
   * a webhook (common), we never create a duplicate row. We return `created`
   * so the webhook handler knows whether to run downstream side-effects
   * (activate subscription, generate invoice, send receipt) exactly once.
   */
  async recordFromWebhook(params: {
    userId: string;
    subscriptionId: string | null;
    payherePaymentId: string;
    orderId: string;
    payhereSubscriptionId: string | null;
    amount: number;
    currency: string;
    status: PaymentStatus;
    statusCode: string;
    paymentDate: Date;
    rawPayload: Record<string, unknown>;
  }): Promise<{ payment: PaymentDoc; created: boolean }> {
    const existing = await Payment.findOne({
      payherePaymentId: params.payherePaymentId,
    });
    if (existing) return { payment: existing, created: false };

    try {
      const payment = await Payment.create({
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        amount: params.amount,
        currency: params.currency,
        paymentMethod: "PAYHERE",
        payherePaymentId: params.payherePaymentId,
        orderId: params.orderId,
        payhereSubscriptionId: params.payhereSubscriptionId,
        transactionId: params.payherePaymentId,
        status: params.status,
        statusCode: params.statusCode,
        paymentDate: params.paymentDate,
        rawPayload: params.rawPayload,
      });
      return { payment, created: true };
    } catch (err: unknown) {
      // Concurrent duplicate webhook → fetch the winner.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        const winner = await Payment.findOne({
          payherePaymentId: params.payherePaymentId,
        });
        if (winner) return { payment: winner, created: false };
      }
      throw err;
    }
  },

  async listForUser(userId: string, opts: { skip: number; limit: number }) {
    const [items, total] = await Promise.all([
      Payment.find({ userId })
        .sort({ paymentDate: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .lean<PaymentDoc[]>(),
      Payment.countDocuments({ userId }),
    ]);
    return { items: items.map(serializePayment), total };
  },

  async totalsForUser(userId: string) {
    const [agg] = await Payment.aggregate<{ total: number; count: number }>([
      { $match: { userId: toObjectId(userId), status: PAYMENT_STATUS.SUCCESS } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    return { totalPaid: agg?.total ?? 0, count: agg?.count ?? 0 };
  },
};

// Local helper to avoid importing mongoose Types everywhere.
import { Types } from "mongoose";
function toObjectId(id: string) {
  return new Types.ObjectId(id);
}
