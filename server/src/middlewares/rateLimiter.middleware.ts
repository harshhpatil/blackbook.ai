import rateLimit from 'express-rate-limit';

// rate limiter for login routes to prevent brute force attacks
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 7,
  message: 'too many login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// rate limiter for register routes to prevent brute force attacks
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'too many register attempts, please try again after 60 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// rate limiter for change password routes to prevent brute force attacks
export const changePasswordLimiter = rateLimit({
  windowMs: 3 * 24 * 60 * 60 * 1000,
  max: 15,
  message: 'too many password change attempts, please try again after 3 days',
  standardHeaders: true,
  legacyHeaders: false,
});

// rate limiter for verify email routes to prevent brute force attacks
export const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message:
    'too many email verification attempts, please try again after 60 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// rate limiter for refresh token routes to prevent brute force attacks
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'too many refresh token attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// rate limiter for forgot password routes to prevent brute force attacks
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message:
    'too many forgot password attempts, please try again after 60 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// rate limiter for reset password routes to prevent brute force attacks
export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message:
    'too many reset password attempts, please try again after 60 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
