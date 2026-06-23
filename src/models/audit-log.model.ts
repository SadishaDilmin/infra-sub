import mongoose, { type Model, type InferSchemaType } from "mongoose";
const { Schema, model, models } = mongoose;

/**
 * Append-only audit log. Records security- and compliance-relevant events
 * (logins, role/status changes, plan changes, payments, admin actions).
 *
 * COMPLIANCE: audit logs must be effectively immutable. We expose no update or
 * delete paths in the service layer, and the schema disables `updatedAt`. If you
 * require stronger guarantees, enable MongoDB Atlas audit log / write-once
 * storage and restrict the app DB user to insert+find on this collection.
 */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorEmail: { type: String, default: null },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & {
  _id: string;
};

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ||
  model<AuditLogDoc>("AuditLog", auditLogSchema);
