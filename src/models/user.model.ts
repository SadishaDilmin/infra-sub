import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { ROLES, USER_STATUS } from "@/config/constants";

/**
 * User account. The password hash is `select: false` so it is never returned by
 * default queries — callers must explicitly `.select("+password")` when they
 * need to verify credentials. This prevents accidental hash exposure.
 */
const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING,
      index: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    phone: { type: String, trim: true },
    lastLoginAt: { type: Date, default: null },
    // Bumped on password change / forced logout to invalidate existing refresh
    // tokens issued before this time (defence in depth alongside RT rotation).
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string };

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", userSchema);
