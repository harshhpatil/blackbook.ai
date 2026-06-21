import mongoose, { Schema, Document } from 'mongoose';

// defining the audit schema's interface
export interface IAudit extends Document {
  user: mongoose.Types.ObjectId;
  event: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, any>;
  createdAt: Date;
}

// defining the audit schema
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
  { timestamps: { createdAt: true, updatedAt: false } }
);

// exporting the audit model
export const Audit = mongoose.model<IAudit>('Audit', AuditSchema);
