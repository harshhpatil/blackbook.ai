import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface IAudit
 * @extends {Document}
 * @description An immutable ledger for tracking critical security and system events.
 */
export interface IAudit extends Document {
  /** The user who triggered the event */
  user: mongoose.Types.ObjectId;
  /** The specific action performed (e.g., 'payment_checkout_created', 'user_login') */
  event: string;
  /** The IP address from which the request originated */
  ip?: string;
  /** The browser or client user agent string */
  userAgent?: string;
  /** Flexible payload for event-specific data (e.g., orderId, amount, metadata) */
  meta?: Record<string, unknown>;
  /** Timestamp of when the event occurred (auto-generated) */
  createdAt: Date;
}

const AuditSchema: Schema<IAudit> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: String,
      required: true,
    },
    ip: String,
    userAgent: String,
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false } 
  }
);

// 1. Speeds up queries fetching a specific user's activity timeline (e.g., "Recent Logins")
AuditSchema.index({ user: 1, createdAt: -1 });

// 2. Speeds up system-wide security analytics (e.g., "Find all 'payment_checkout_created' events today")
AuditSchema.index({ event: 1, createdAt: -1 });

export const Audit = mongoose.model<IAudit>('Audit', AuditSchema);