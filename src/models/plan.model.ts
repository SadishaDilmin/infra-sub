import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * Subscription plan. Plans are fully dynamic — admins create unlimited plans
 * (Starter / Business / Enterprise are just seeded examples). Prices are stored
 * as numbers in the plan currency's major unit (e.g. LKR 4500.00).
 */
const planSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: "", maxlength: 500 },
    monthlyPrice: { type: Number, required: true, min: 0 },
    yearlyPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "LKR" },
    features: { type: [String], default: [] },
    // Highlighted on the pricing page.
    highlighted: { type: Boolean, default: false },
    // Sort order on the pricing page.
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export type PlanDoc = InferSchemaType<typeof planSchema> & { _id: string };

export const Plan: Model<PlanDoc> =
  (models.Plan as Model<PlanDoc>) || model<PlanDoc>("Plan", planSchema);
