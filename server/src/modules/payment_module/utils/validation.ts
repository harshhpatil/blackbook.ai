import { z } from 'zod';

export const checkoutSchema = z.object({
  body: z.object({
    amount: z
      .number({ message: 'Amount is required' })
      .int({
        message:
          'Amount must be an integer (smallest currency unit, e.g., paise)',
      })
      .positive({ message: 'Amount must be greater than zero' }),
    currency: z
      .string({ message: 'Currency is required' })
      .length(3, { message: 'Currency must be a 3-letter ISO code' })
      .default('INR'),
    purpose: z
      .string({ message: 'Purpose is required' })
      .min(3, { message: 'Purpose must be at least 3 characters long' }),
    idempotencyKey: z
      .string({ message: 'Idempotency key is required' })
      .min(10, { message: 'Invalid idempotency key format' }),
    planPurchased: z.enum(['normal', 'pro', 'premium'], {
      message: 'Please select a valid plan (normal, pro, or premium)',
    }),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z
      .string({ message: 'Razorpay order ID is required' })
      .startsWith('order_', { message: 'Invalid Razorpay order ID format' }),
    razorpay_payment_id: z
      .string({ message: 'Razorpay payment ID is required' })
      .startsWith('pay_', { message: 'Invalid Razorpay payment ID format' }),
    razorpay_signature: z
      .string({ message: 'Razorpay signature is required' })
      .min(10, { message: 'Invalid signature format' }),
  }),
});
