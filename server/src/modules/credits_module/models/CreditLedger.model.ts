import mongoose, { Document, Schema } from 'mongoose';

export type CreditTransactionType =
  | 'purchase'
  | 'generation_deduction'
  | 'refund'
  | 'signup_bonus'
  | 'admin_grant';

export interface ICreditLedger extends Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  type: CreditTransactionType;
  description: string;
  balanceAfter: number;
  createdAt: Date;
}

const CreditLedgerSchema = new Schema<ICreditLedger>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['purchase', 'generation_deduction', 'refund', 'signup_bonus', 'admin_grant'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CreditLedgerSchema.index({ user: 1, createdAt: -1 });

export const CreditLedger = mongoose.model<ICreditLedger>(
  'CreditLedger',
  CreditLedgerSchema
);
