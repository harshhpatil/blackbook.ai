import mongoose, { Document, Schema } from 'mongoose';

/**
 * @interface ISubscriptionHistory
 * @extends {Document}
 * @description An immutable ledger tracking every time a user's subscription tier changes.
 */
export interface ISubscriptionHistory extends Document {
  user: mongoose.Types.ObjectId;    
  oldPlan: 'none' | 'normal' | 'pro' | 'premium';
  newPlan: 'none' | 'normal' | 'pro' | 'premium';
  action: 'upgrade' | 'downgrade' | 'renewal' | 'admin_grant' | 'cancellation';
  reference: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionHistorySchema = new Schema<ISubscriptionHistory>(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    oldPlan: { 
      type: String, 
      enum: ['none', 'normal', 'pro', 'premium'], 
      required: true 
    },
    newPlan: { 
      type: String, 
      enum: ['none', 'normal', 'pro', 'premium'], 
      required: true 
    },
    action: { 
      // Added 'cancellation' to handle users dropping back down to 'none'
      type: String, 
      enum: ['upgrade', 'downgrade', 'renewal', 'admin_grant', 'cancellation'], 
      required: true 
    },
    reference: { 
      type: String, 
      required: true, 
      unique: true 
    },
  },
  { timestamps: true }
);

SubscriptionHistorySchema.index({ user: 1, createdAt: -1 });

export const SubscriptionHistory = mongoose.model<ISubscriptionHistory>(
  'SubscriptionHistory', 
  SubscriptionHistorySchema
);