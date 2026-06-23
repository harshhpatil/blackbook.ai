import mongoose, { Schema, Document } from 'mongoose';

// defining the interface for the PaymentWebhookEvent model
export interface IPaymentWebhookEvent extends Document {
  provider: 'string';
  providerEventId: string;
  eventType: string;
  status: 'received' | 'processed' | 'failed';
  payloadHash: string;
  error?: string;
}

// defining the schema for the PaymentWebhookEvent model
const schema = new Schema(
  {
    provider: String,

    providerEventId: {
      type: String,
      unique: true,
      required: true,
    },

    eventType: String,

    status: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received',
    },

    payloadHash: String,

    error: String,
  },
  {
    timestamps: true,
  }
);

// creating the PaymentWebhookEvent model
export const PaymentWebhookEvent = mongoose.model<IPaymentWebhookEvent>(
  'PaymentWebhookEvent',
  schema
);
