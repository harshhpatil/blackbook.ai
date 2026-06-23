import { z } from 'zod';

// password validation schema - reusable
const passwordSchema = z
  .string()
  .min(8, 'password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'password must be 72 bytes or fewer',
  })
  .refine(
    (value) =>
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[!@#$%^&*]/.test(value),
    {
      message:
        'password must contain uppercase, lowercase, number and special character',
    }
  );

// login validation schema
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().max(72),
});

// register validation schema
export const registerSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});

// change password validation schema
export const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: passwordSchema,
});

// forgot password validation schema
export const forgotPasswordSchema = z.object({
  email: z.email(),
});

// reset password validation schema
export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: passwordSchema,
});

// verify payment schema
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z
    .string({
      message: 'razorpay_order_id is required',
    })
    .trim()
    .min(1, 'razorpay_order_id is required'),

  razorpay_payment_id: z
    .string({
      message: 'razorpay_payment_id is required',
    })
    .trim()
    .min(1, 'razorpay_payment_id is required'),

  razorpay_signature: z
    .string({
      message: 'razorpay_signature is required',
    })
    .trim()
    .min(1, 'razorpay_signature is required'),
});
