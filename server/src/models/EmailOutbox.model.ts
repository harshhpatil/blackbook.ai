import mongoose, { Document, Schema } from 'mongoose';

export type EmailOutboxEventName =
  | 'send-verification-email'
  | 'send-welcome-email'
  | 'send-password-reset-email';

export interface IEmailOutbox extends Document {
  eventName: EmailOutboxEventName;
  payload: Record<string, string>;
  status: 'pending' | 'published' | 'failed';
  attempts: number;
  lastError?: string;
  publishedAt?: Date;
  createdAt: Date;
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
      ],
      required: true,
    },
    payload: {
      type: Map,
      of: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'published', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: String,
    publishedAt: Date,
  },
  { timestamps: true }
);

EmailOutboxSchema.index({ status: 1, createdAt: 1 });

export const EmailOutbox = mongoose.model<IEmailOutbox>(
  'EmailOutbox',
  EmailOutboxSchema
);
