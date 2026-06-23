import mongoose, { type Model, type InferSchemaType } from "mongoose";
const { Schema, model, models } = mongoose;
import { BILLING_INTERVAL, SUBSCRIPTION_STATUS } from "@/config/constants";

/**
 * A customer's subscription to a plan. We keep a denormalised snapshot of price
 * and currency at purchase time so historic billing is stable even if the plan
 * later changes. `payhereSubscriptionId` links to PayHere's recurring token.
 */
const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },

    interval: {
      type: String,
      enum: Object.values(BILLING_INTERVAL),
      required: true,
    },
    // Price snapshot at purchase.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "LKR" },

    payhereSubscriptionId: { type: String, default: null, index: true },
    // The order_id we generated for the initial checkout (idempotency anchor).
    checkoutOrderId: { type: String, default: null, index: true },

    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.PENDING,
      index: true,
    },

    startedAt: { type: Date, default: null },
    nextBillingDate: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// A user can have at most one non-terminal subscription at a time. Partial
// unique index enforces this at the DB layer (defence beyond app logic).
subscriptionSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PENDING, SUBSCRIPTION_STATUS.PAST_DUE] },
    },
  },
);

export type SubscriptionDoc = InferSchemaType<typeof subscriptionSchema> & {
  _id: string;
};

export const Subscription: Model<SubscriptionDoc> =
  (models.Subscription as Model<SubscriptionDoc>) ||
  model<SubscriptionDoc>("Subscription", subscriptionSchema);
