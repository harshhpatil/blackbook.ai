import mongoose, { Document, Schema } from 'mongoose';

export interface ICreditTransaction extends Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  type: 'payment_grant' | 'generation_charge' | 'generation_refund';
  reference: string;
  balanceAfter: number;
  createdAt: Date;
  updatedAt: Date;
}

const CreditTransactionSchema = new Schema<ICreditTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['payment_grant', 'generation_charge', 'generation_refund'], required: true },
    reference: { type: String, required: true, unique: true },
    balanceAfter: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

CreditTransactionSchema.index({ user: 1, createdAt: -1 });
export const CreditTransaction = mongoose.model<ICreditTransaction>('CreditTransaction', CreditTransactionSchema);
