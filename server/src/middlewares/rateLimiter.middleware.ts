import rateLimit, { Options } from 'express-rate-limit';
import { RedisRateLimitStore } from './redisRateLimitStore.ts';

const normalizedBodyValue = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
};

const createLimiter = (
  name: string,
  options: Partial<Options>
): ReturnType<typeof rateLimit> => {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    store: new RedisRateLimitStore(name),
    keyGenerator: (req) => {
      const email = normalizedBodyValue(req.body?.email);
      return email ? `${req.ip}:${email}` : req.ip ?? 'unknown';
    },
    ...options,
  });
};

// rate limiter for login routes to prevent brute force attacks
export const loginLimiter = createLimiter('login', {
  windowMs: 15 * 60 * 1000,
  max: 7,
  message: 'too many login attempts, please try again after 15 minutes',
});

// rate limiter for register routes to prevent brute force attacks
export const registerLimiter = createLimiter('register', {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'too many register attempts, please try again after 60 minutes',
});

// rate limiter for change password routes to prevent brute force attacks
export const changePasswordLimiter = createLimiter('change-password', {
  windowMs: 3 * 24 * 60 * 60 * 1000,
  max: 15,
  message: 'too many password change attempts, please try again after 3 days',
});

// rate limiter for verify email routes to prevent brute force attacks
export const verifyEmailLimiter = createLimiter('verify-email', {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message:
    'too many email verification attempts, please try again after 60 minutes',
});

// rate limiter for refresh token routes to prevent brute force attacks
export const refreshTokenLimiter = createLimiter('refresh-token', {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'too many refresh token attempts, please try again after 15 minutes',
});

// rate limiter for forgot password routes to prevent brute force attacks
export const forgotPasswordLimiter = createLimiter('forgot-password', {
  windowMs: 60 * 60 * 1000,
  max: 15,
  message:
    'too many forgot password attempts, please try again after 60 minutes',
});

// rate limiter for reset password routes to prevent brute force attacks
export const resetPasswordLimiter = createLimiter('reset-password', {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message:
    'too many reset password attempts, please try again after 60 minutes',
});
