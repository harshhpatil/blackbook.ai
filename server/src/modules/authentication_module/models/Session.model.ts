import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface ISession
 * @extends {Document}
 * @description Represents a user's active session or refresh token in the database.
 */
export interface ISession extends Document {
  /** Reference to the User who owns this session */
  user: mongoose.Types.ObjectId;
  /** Hashed version of the refresh token family for rotation/tracking */
  tokenHash?: string;
  /** Exact date and time when this session becomes invalid */
  expiresAt: Date;
  /** If true, the session was manually killed (e.g., user clicked "Log out of all devices") */
  revoked: boolean;
  /** The device/browser information captured during login */
  userAgent?: string;
  /** The IP address from which the session was created */
  ip?: string;
  /** Timestamp of session creation */
  createdAt: Date;
  /** Timestamp of last session update */
  updatedAt: Date;
}

/**
 * @constant SessionSchema
 * @description Mongoose schema definition for the Session model.
 */
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

// Compound index for verifying an active session quickly
SessionSchema.index({ tokenHash: 1, revoked: 1, expiresAt: 1 });

// Compound index for querying all active sessions for a specific user (e.g., Settings -> Security page)
SessionSchema.index({ user: 1, revoked: 1, createdAt: -1, expiresAt: 1 });

// TTL (Time-To-Live) Index: MongoDB will automatically delete the document when current time > expiresAt
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * @exports Session
 * @description The compiled Mongoose model for Session operations.
 */
export const Session = mongoose.model<ISession>('Session', SessionSchema);