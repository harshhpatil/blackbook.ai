import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface IPaymentWebhookEvent
 * @extends {Document}
 * @description Tracks incoming webhooks from payment providers (Razorpay) to ensure idempotency and prevent double-processing.
 */
export interface IPaymentWebhookEvent extends Document {
  /** The payment provider (e.g., 'razorpay') */
  provider: string;
  /** The unique ID of the event sent by the provider (e.g., 'evnt_xxx') */
  providerEventId: string;
  /** The type of event (e.g., 'order.paid', 'payment.captured') */
  eventType: string;
  /** Processing status of this webhook */
  status: 'received' | 'processed' | 'failed';
  /** SHA-256 hash of the raw payload to detect duplicate/altered deliveries */
  payloadHash: string;
  /** Error message if processing failed */
  error?: string;
  /** Document creation timestamp */
  createdAt: Date;
  /** Document update timestamp */
  updatedAt: Date;
}

const schema = new Schema<IPaymentWebhookEvent>(
  {
    provider: {
      type: String,
      required: true,
      default: 'razorpay',
    },
    providerEventId: {
      type: String,
      unique: true,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received',
    },
    payloadHash: {
      type: String,
      required: true,
    },
    error: String,
  },
  {
    timestamps: true,
  }
);

// Index to quickly query failed webhooks if you ever write a chron job to retry them
schema.index({ status: 1 });

export const PaymentWebhookEvent = mongoose.model<IPaymentWebhookEvent>(
  'PaymentWebhookEvent',
  schema
);