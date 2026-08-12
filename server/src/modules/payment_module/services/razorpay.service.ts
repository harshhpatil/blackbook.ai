import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { env } from '../../../core/config/env.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('razorpay-service');

// Initialize the Razorpay SDK using your validated environment variables
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

/**
 * @function createRazorpayOrder
 * @description Contacts Razorpay's servers to generate a secure Order ID.
 * This ID must be passed to the frontend to initialize the payment modal.
 *
 * @param {number} amount - The amount in the smallest currency unit (e.g., paise for INR. 500 INR = 50000 paise).
 * @param {string} currency - The 3-letter ISO currency code (e.g., 'INR').
 * @param {string} receipt - A unique identifier for this order (usually the Mongoose PaymentOrder _id or idempotency key).
 * @returns {Promise<any>} The Razorpay order object containing the `id`.
 */
export async function createRazorpayOrder(
  amount: number,
  currency: string = 'INR',
  receipt: string
) {
  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
    });

    log.info(
      { orderId: order.id, receipt },
      'Razorpay order generated successfully'
    );
    return order;
  } catch (err) {
    log.error({ err, amount, receipt }, 'Failed to generate Razorpay order');
    throw new Error('Payment gateway error while creating order', {cause: err});
  }
}

/**
 * @function verifyWebhookSignature
 * @description Cryptographically verifies that an incoming webhook was actually sent by Razorpay and hasn't been tampered with.
 *
 * @param {string} rawBody - The raw, unparsed JSON string of the request body.
 * @param {string} signature - The `x-razorpay-signature` header sent by Razorpay.
 * @param {string} secret - Your private Razorpay webhook secret.
 * @returns {boolean} True if the signature is valid, false if it's forged.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Prevent timing attacks by using crypto.timingSafeEqual
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );

    if (!isValid) {
      log.warn('Razorpay webhook signature verification failed');
    }

    return isValid;
  } catch (err) {
    log.error({ err }, 'Error during webhook signature verification');
    return false;
  }
}
