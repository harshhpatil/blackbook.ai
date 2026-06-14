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

// exporting the session model
export const Session = mongoose.model<ISession>('Session', SessionSchema);
