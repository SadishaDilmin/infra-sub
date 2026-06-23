import mongoose, { type Model, type InferSchemaType } from "mongoose";
const { Schema, model, models } = mongoose;
import { INVOICE_STATUS } from "@/config/constants";

/**
 * Invoice generated for a successful payment. `invoiceNumber` is a
 * human-readable sequential identifier (e.g. INV-2026-000123) and is unique.
 */
const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true, // one invoice per payment
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    planName: { type: String, default: "" },

    amount: { type: Number, required: true, min: 0 }, // pre-tax
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "LKR" },

    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.PAID,
      index: true,
    },
  },
  { timestamps: true },
);

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema> & { _id: string };

export const Invoice: Model<InvoiceDoc> =
  (models.Invoice as Model<InvoiceDoc>) ||
  model<InvoiceDoc>("Invoice", invoiceSchema);
