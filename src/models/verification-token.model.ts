import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { VERIFICATION_TOKEN_TYPE } from "@/config/constants";

/**
 * Single-use tokens for email verification and password reset. Only the hash is
 * stored. A TTL index auto-expires records at `expiresAt`.
 */
const verificationTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: Object.values(VERIFICATION_TOKEN_TYPE),
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, index: true },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type VerificationTokenDoc = InferSchemaType<
  typeof verificationTokenSchema
> & { _id: string };

export const VerificationToken: Model<VerificationTokenDoc> =
  (models.VerificationToken as Model<VerificationTokenDoc>) ||
  model<VerificationTokenDoc>("VerificationToken", verificationTokenSchema);
