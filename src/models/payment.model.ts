import mongoose, { type Model, type InferSchemaType } from "mongoose";
const { Schema, model, models } = mongoose;
import { PAYMENT_STATUS } from "@/config/constants";

/**
 * A payment attempt/result. The PayHere `payment_id` is the natural idempotency
 * key — a UNIQUE index guarantees we never insert duplicate payment records even
 * if PayHere retries the webhook. `rawPayload` keeps an immutable audit trail of
 * exactly what the gateway sent.
 */
const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "LKR" },
    paymentMethod: { type: String, default: "PAYHERE" },

    // PayHere identifiers.
    payherePaymentId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    payhereSubscriptionId: { type: String, default: null, index: true },

    // Generic transaction id surfaced to the customer (== payherePaymentId).
    transactionId: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      required: true,
      index: true,
    },
    statusCode: { type: String, default: null },

    paymentDate: { type: Date, required: true },

    // Immutable copy of the gateway notification for audit/reconciliation.
    rawPayload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: string };

export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc>) ||
  model<PaymentDoc>("Payment", paymentSchema);
