import mongoose, { Document, Schema } from 'mongoose';

/**
 * Strictly defined event names to ensure typo-free email triggering across the app.
 */
export type EmailOutboxEventName =
  | 'send-verification-email'
  | 'send-welcome-email'
  | 'send-password-reset-email'
  | 'send-password-changed-email';

/**
 * @interface IEmailOutbox
 * @extends {Document}
 * @description Implements the Transactional Outbox pattern to guarantee email delivery
 * even if the external email provider (e.g., SendGrid/AWS SES) is temporarily down.
 */
export interface IEmailOutbox extends Document {
  /** The type of email to send */
  eventName: EmailOutboxEventName;
  /** The dynamic data required for the email template (e.g., email address, tokens, names) */
  payload: Record<string, string>;
  /** The current state of the outbox event */
  status: 'pending' | 'queued' | 'sent' | 'failed';
  /** Number of times the worker has attempted to process this event */
  attempts: number;
  /** The error message from the last failed attempt */
  lastError?: string;
  /** Timestamp of when the event was successfully handed off to the queue/email provider */
  publishedAt?: Date;
  /** Timestamp of successful provider delivery */
  deliveredAt?: Date;
  /** Document creation timestamp */
  createdAt: Date;
  /** Document update timestamp */
  updatedAt: Date;
}

const EmailOutboxSchema = new Schema<IEmailOutbox>(
  {
    eventName: {
      type: String,
      enum: [
        'send-verification-email',
        'send-welcome-email',
        'send-password-reset-email',
        'send-password-changed-email',
      ],
      required: true,
    },
    payload: {
      // Mixed is preferable here over Map to perfectly align with TypeScript's Record<string, string>
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: String,
    publishedAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true }
);

// High-performance index for the background worker polling for pending emails, sorted by oldest first
EmailOutboxSchema.index({ status: 1, createdAt: 1 });

export const EmailOutbox = mongoose.model<IEmailOutbox>(
  'EmailOutbox',
  EmailOutboxSchema
);
