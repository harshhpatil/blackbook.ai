import mongoose, { Schema, Document } from 'mongoose';

// defining the interface for the PaymentOrder document
export interface IPaymentOrder extends Document {
  user: mongoose.Types.ObjectId;
  provider: 'razorpay';
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  purpose: string;
  status: 'created' | 'paid' | 'failed' | 'refunded' | 'pending' | 'cancelled';
  idempotencyKey: string;
  creditsGranted: number;
  creditsGrantedAt?: Date;
}

// defining the schema for the PaymentOrder model
const paymentOrderSchema = new Schema<IPaymentOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    provider: {
      type: String,
      default: 'razorpay',
    },

    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },

    razorpayPaymentId: String,

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ['created', 'pending', 'paid', 'failed', 'cancelled', 'refunded'],
      default: 'created',
    },

    idempotencyKey: {
      type: String,
      unique: true,
      required: true,
    },
    creditsGranted: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditsGrantedAt: Date,
  },
  {
    timestamps: true,
  }
);

// exporting the PaymentOrder model
export const PaymentOrder = mongoose.model<IPaymentOrder>(
  'PaymentOrder',
  paymentOrderSchema
);
