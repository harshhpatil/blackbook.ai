import mongoose, { Schema, Document } from 'mongoose';

// defining the session schema's interface
export interface ISession extends Document {
  user: mongoose.Types.ObjectId;
  tokenHash?: string;
  expiresAt: Date;
  revoked: boolean;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

// defining the session schema
const SessionSchema: Schema<ISession> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: String,
    expiresAt: {
      type: Date,
      required: true,
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

SessionSchema.index({ tokenHash: 1, revoked: 1, expiresAt: 1 });
SessionSchema.index({ user: 1, revoked: 1, createdAt: -1, expiresAt: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// exporting the session model
export const Session = mongoose.model<ISession>('Session', SessionSchema);
