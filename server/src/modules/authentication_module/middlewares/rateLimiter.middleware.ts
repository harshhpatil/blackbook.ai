// Adjust this import path based on exactly where your core createLimiter lives
import { createLimiter } from '../../../core/middlewares/rateLimiter.middleware.ts';

// 1. Login Limiter: Strict. Prevents credential stuffing and brute-force guessing.
export const loginLimiter = createLimiter('login', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
});

// 2. Register Limiter: Very Strict. Prevents mass bot account creation.
export const registerLimiter = createLimiter('register', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { message: 'Too many accounts created from this IP, please try again after an hour' },
});

// 3. Password Reset/Forgot Limiter: Strict. Prevents email spamming.
export const forgotPasswordLimiter = createLimiter('forgot-password', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { message: 'Too many password reset requests, please try again later' },
});

export const resetPasswordLimiter = createLimiter('reset-password', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Too many attempts, please try again later' },
});

export const changePasswordLimiter = createLimiter('change-password', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many attempts, please try again later' },
});

// 4. Token & Email Limiter: Moderate. Prevents endpoint abuse.
export const verifyEmailLimiter = createLimiter('verify-email', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many verification attempts, please try again later' },
});

export const refreshTokenLimiter = createLimiter('refresh-token', {
  windowMs: 15 * 60 * 1000,
  max: 20, // Slightly higher for multiple browser tabs
  message: { message: 'Too many refresh requests, please try again later' },
});