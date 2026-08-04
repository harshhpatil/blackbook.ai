import mongoose from 'mongoose';
import { env } from '../config/env.ts';
import { CreditTransaction } from '../models/CreditTransaction.model.ts';
import { PaymentOrder } from '../models/PaymentOrder.model.ts';
import { User } from '../models/Users.model.ts';

export class CreditError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'CreditError';
  }
}

const creditPackages = (): Record<string, number> => {
  try {
    const parsed = JSON.parse(env.CREDIT_PACKAGES_JSON) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, credits]) => Number.isInteger(credits) && Number(credits) > 0)) as Record<string, number>;
  } catch {
    throw new CreditError('CREDIT_PACKAGES_JSON must be a JSON object of purpose-to-credit mappings', 500);
  }
};

const withSession = async <T>(operation: (session: mongoose.ClientSession) => Promise<T>): Promise<T> => {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => { result = await operation(session); });
    return result as T;
  } finally {
    await session.endSession();
  }
};

export async function grantCreditsForPayment(orderId: string): Promise<number> {
  return withSession(async (session) => {
    const order = await PaymentOrder.findById(orderId).session(session);
    if (!order || order.status !== 'paid') return 0;
    const credits = creditPackages()[order.purpose] ?? 0;
    if (!credits || order.creditsGranted > 0) return 0;
    const user = await User.findByIdAndUpdate(order.user, { $inc: { credits } }, { new: true, session });
    if (!user) throw new CreditError('Payment user no longer exists', 500);
    await CreditTransaction.create([{
      user: user._id, amount: credits, type: 'payment_grant', reference: `payment:${order._id}`, balanceAfter: user.credits,
    }], { session });
    order.creditsGranted = credits;
    order.creditsGrantedAt = new Date();
    await order.save({ session });
    return credits;
  });
}

export async function chargeGenerationCredits(userId: string, generationJobId: string): Promise<number> {
  const cost = env.GENERATION_CREDIT_COST;
  if (cost === 0) return 0;
  return withSession(async (session) => {
    const reference = `generation-charge:${generationJobId}`;
    const existing = await CreditTransaction.findOne({ reference }).session(session);
    if (existing) return -existing.amount;
    const user = await User.findOneAndUpdate({ _id: userId, credits: { $gte: cost } }, { $inc: { credits: -cost } }, { new: true, session });
    if (!user) throw new CreditError('Insufficient credits to generate this document', 402);
    await CreditTransaction.create([{
      user: user._id, amount: -cost, type: 'generation_charge', reference, balanceAfter: user.credits,
    }], { session });
    return cost;
  });
}

export async function refundGenerationCredits(userId: string, generationJobId: string): Promise<void> {
  const cost = env.GENERATION_CREDIT_COST;
  if (cost === 0) return;
  await withSession(async (session) => {
    const charge = await CreditTransaction.findOne({ reference: `generation-charge:${generationJobId}` }).session(session);
    const reference = `generation-refund:${generationJobId}`;
    if (!charge || await CreditTransaction.exists({ reference }).session(session)) return;
    const user = await User.findByIdAndUpdate(userId, { $inc: { credits: cost } }, { new: true, session });
    if (!user) return;
    await CreditTransaction.create([{
      user: user._id, amount: cost, type: 'generation_refund', reference, balanceAfter: user.credits,
    }], { session });
  });
}
