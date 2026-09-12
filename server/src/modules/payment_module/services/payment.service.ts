  import crypto from 'node:crypto';
import { env } from '../../../core/config/env.ts';
import { createRazorpayOrder } from './razorpay.service.ts';
import { PaymentOrder } from '../models/PaymentOrder.model.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('payment-service');

/**
 * @interface CreateCheckoutParams
 * @description Parameters required to initialize a new subscription checkout order.
 */
interface CreateCheckoutParams {
  userId: string;
  amount: number;
  currency: string;
  purpose: string;
  idempotencyKey: string;
  planPurchased: 'normal' | 'pro' | 'premium'; // Ensures we know what they are buying
}

/**
 * @function createCheckout
 * @description Generates a secure order ID from Razorpay and creates a pending record in the database.
 * @param {CreateCheckoutParams} params
 * @returns {Promise<{ order: IPaymentOrder, razorpayOrder: any }>}
 */
export async function createCheckout({
  userId,
  amount,
  currency,
  purpose,
  idempotencyKey,
  planPurchased,
}: CreateCheckoutParams) {
  // 1. Generate the order in Razorpay using our secure helper
  const razorpayOrder = await createRazorpayOrder(
    amount,
    currency,
    idempotencyKey
  );

  try {
    // 2. Create a pending payment order in the database
    const order = await PaymentOrder.create({
      user: userId,
      provider: 'razorpay',
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency,
      purpose,
      status: 'created',
      idempotencyKey,
      planPurchased,
    });

    log.info(
      { orderId: order._id, razorpayOrderId: razorpayOrder.id },
      'Checkout order created successfully'
    );

    return { order, razorpayOrder };
  } catch (err) {
    log.error(
      { err, idempotencyKey },
      'Failed to save PaymentOrder to database'
    );
    throw new Error(`Failed to initialize checkout`, { cause: err });
  }
}

/**
 * @interface VerifyPaymentParams
 * @description The payload returned by the Razorpay frontend checkout modal.
 */
interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * @function verifyPayment
 * @description Validates the cryptographic signature returned by the frontend to ensure the payment was authentic.
 * @param {VerifyPaymentParams} params
 * @returns {boolean} True if authentic, false if tampered with.
 */
export function verifyPayment({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}: VerifyPaymentParams): boolean {
  try {
    const secret: string = env.RAZORPAY_KEY_SECRET!;

    // Razorpay requires the payload to be formatted exactly as "order_id|payment_id"
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(generatedSignature);
    const receivedBuffer = Buffer.from(razorpay_signature);

    // CRITICAL FIX: timingSafeEqual throws an exception if buffer lengths do not match.
    // We must check length first to prevent server crashes from malformed hacking attempts.
    if (expectedBuffer.length !== receivedBuffer.length) {
      log.warn('Payment signature verification failed due to length mismatch');
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    log.error({ err }, 'Error during frontend payment signature verification');
    return false;
  }
}
