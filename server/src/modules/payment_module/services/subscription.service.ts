import mongoose, { ClientSession } from 'mongoose';
import { User } from '../../authentication_module/models/Users.model.ts'; 
import { SubscriptionHistory } from '../models/SubscriptionHistory.model.ts';
import { createLogger } from '../../../core/lib/logger.ts';
import { addCredits } from '../../credits_module/services/credits.service.ts';

const log = createLogger('subscription-service');

type PlanTier = 'none' | 'normal' | 'pro' | 'premium';
type ActionType =
  | 'upgrade'
  | 'downgrade'
  | 'renewal'
  | 'admin_grant'
  | 'cancellation';

const creditsForPurchase = (purpose: string, plan: PlanTier): number => {
  const packCredits = purpose.match(/credits_(\d+)/)?.[1];
  if (packCredits) return Number(packCredits);
  return { none: 0, normal: 10, pro: 50, premium: 100 }[plan];
};

/**
 * @function changeUserPlan
 * @description Updates a user's subscription tier and securely logs the transaction in the ledger.
 * This function expects to be called inside a Mongoose transaction to guarantee data integrity.
 *
 * @param {string | mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {PlanTier} newPlan - The plan they are moving to.
 * @param {ActionType} action - The context of the change (e.g., 'upgrade' via Razorpay).
 * @param {string} reference - The Razorpay Payment ID or unique identifier for the audit log.
 * @param {ClientSession} mongoSession - The active Mongoose transaction session.
 */
export async function changeUserPlan(
  userId: string | mongoose.Types.ObjectId,
  newPlan: PlanTier,
  action: ActionType,
  reference: string,
  mongoSession: ClientSession,
  purpose = ''
): Promise<void> {
  // 1. Fetch the user within the current transaction session
  const user = await User.findById(userId).session(mongoSession);

  if (!user) {
    log.error({ userId }, 'Attempted to change plan for non-existent user');
    throw new Error('User not found');
  }

  // Typecast safely assuming your User model enforces these enum values
  const oldPlan = user.subscriptionPlan as PlanTier;

  // 2. Apply the new plan to the user profile
  user.subscriptionPlan = newPlan;
  await user.save({ session: mongoSession });

  // 3. Create the immutable ledger entry
  await SubscriptionHistory.create(
    [
      {
        user: user._id,
        oldPlan,
        newPlan,
        action,
        reference,
      },
    ],
    { session: mongoSession }
  );

  const credits = creditsForPurchase(purpose, newPlan);
  if (credits > 0) {
    await addCredits(
      userId.toString(),
      credits,
      'purchase',
      `Purchase ${purpose || newPlan} fulfilled`,
      mongoSession
    );
  }

  log.info(
    { userId, oldPlan, newPlan, action, reference },
    'User subscription updated successfully'
  );
}
