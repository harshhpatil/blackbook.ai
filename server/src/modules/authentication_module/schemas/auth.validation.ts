import { z } from 'zod';

/**
 * Schema for user registration payload
 */
export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),

    name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),

    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters long')
      .max(72, 'Password cannot exceed 72 characters due to security limits'),
  }),
});

/**
 * Schema for changing the password
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),

    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'New password must be at least 8 characters long')
      .max(
        72,
        'New password cannot exceed 72 characters due to security limits'
      ),
  }),
});

/**
 * Schema for user login payload
 */
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),

    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * Schema for requesting a password reset
 */
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
  }),
});

/**
 * Schema for setting a new password via reset token
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),

    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'Password must be at least 8 characters long')
      .max(72, 'Password cannot exceed 72 characters'),
  }),
});

export const googleOAuthSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token cannot be empty'),
  }),
});
