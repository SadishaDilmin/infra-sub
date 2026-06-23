import mongoose, { type Model, type InferSchemaType } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * Refresh-token record for rotation + reuse detection.
 *
 * We store only the SHA-256 hash of the token. On refresh we rotate: the old
 * record is marked `revoked` and a new one issued. If a token that is already
 * revoked is presented again, that signals theft/replay — we revoke the entire
 * token family (`familyId`) to force re-authentication.
 *
 * `expiresAt` has a TTL index so expired records are auto-purged by MongoDB.
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    revoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL index: documents are removed once expiresAt passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & {
  _id: string;
};

export const RefreshToken: Model<RefreshTokenDoc> =
  (models.RefreshToken as Model<RefreshTokenDoc>) ||
  model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
