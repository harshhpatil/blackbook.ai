import mongoose, { ClientSession } from 'mongoose';
import { CreditLedger, CreditTransactionType } from '../models/CreditLedger.model.ts';
import { createLogger } from '../../../core/lib/logger.ts';
import { createAndSendNotification } from '../../notification_module/services/notification.service.ts';

const log = createLogger('credits-service');

export async function getCreditBalance(userId: string): Promise<number> {
  const latestEntry = await CreditLedger.findOne({ user: userId }).sort({ createdAt: -1 });
  return latestEntry ? latestEntry.balanceAfter : 10; // Default signup balance 10 credits
}

export async function getCreditHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [history, total, currentBalance] = await Promise.all([
    CreditLedger.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CreditLedger.countDocuments({ user: userId }),
    getCreditBalance(userId),
  ]);

  return {
    balance: currentBalance,
    history,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function addCredits(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  session?: ClientSession
): Promise<number> {
  const currentBalance = await getCreditBalance(userId);
  const newBalance = currentBalance + amount;

  await CreditLedger.create(
    [
      {
        user: userId,
        amount,
        type,
        description,
        balanceAfter: newBalance,
      },
    ],
    { session }
  );

  log.info({ userId, amount, newBalance, type }, 'Credits added to balance');

  await createAndSendNotification({
    userId,
    title: 'Credits Received',
    message: `${amount} credit(s) added to your account (${description}).`,
    type: 'success',
  }).catch(() => undefined);

  return newBalance;
}

export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  session?: ClientSession
): Promise<number> {
  const currentBalance = await getCreditBalance(userId);

  if (currentBalance < amount) {
    throw new Error(`Insufficient credits. Required: ${amount}, Available: ${currentBalance}`);
  }

  const newBalance = currentBalance - amount;

  await CreditLedger.create(
    [
      {
        user: userId,
        amount: -amount,
        type: 'generation_deduction',
        description,
        balanceAfter: newBalance,
      },
    ],
    { session }
  );

  log.info({ userId, amount, newBalance }, 'Credits deducted');
  return newBalance;
}
