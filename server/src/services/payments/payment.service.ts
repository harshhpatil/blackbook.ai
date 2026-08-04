import crypto from 'node:crypto';
import { env } from '../../config/env.ts';

import { razorpay } from '../razorpay.service.ts';
import { PaymentOrder } from '../../models/PaymentOrder.model.ts';

// defining the interface for the createCheckout function parameters
interface createCheckoutParams {
  userId: string;
  amount: number;
  currency: string;
  purpose: string;
  idempotencyKey: string;
}

// function to create a new checkout order
export async function createCheckout({
  userId,
  amount,
  currency,
  purpose,
  idempotencyKey,
}: createCheckoutParams) {
  // creating a new payment order in the database with the provided details
  const razorpayOrder = await razorpay.orders.create({
    amount: amount,
    currency,
    receipt: idempotencyKey,
  });

  // creating a new payment order in the database with the provided details
  const order = await PaymentOrder.create({
    user: userId,
    provider: 'razorpay',
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency,
    purpose,
    idempotencyKey,
    status: 'created',
  });

  // returning the created order and the Razorpay order details
  return { order, razorpayOrder };
}

// defining the interface for the verifyPayment function parameters
interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// defining the function to verify the payment using Razorpay's signature verification
export function verifyPayment({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}: VerifyPaymentParams): boolean {
  const secret = env.RAZORPAY_KEY_SECRET;

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(generatedSignature),
    Buffer.from(razorpay_signature)
  );
}
