import { NextFunction, Request, Response, Router } from 'express';

// 1. Local Module Imports (Controllers, Middlewares, Schemas)
import {
  login,
  register,
  verifyEmail,
  refreshToken,
  logout,
  changePassword,
  logoutSession,
  getSessions,
  forgotPassword,
  logoutAllSessions,
  resetPassword,
  googleLogin,
  sendOtpHandler,
  verifyOtpHandler,
} from './controllers/auth.controller.ts';
import { authenticate } from './middlewares/auth.middleware.ts';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema, // Added this since you use it below
  resetPasswordSchema,
  googleOAuthSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from './schemas/auth.validation.ts';

// 2. Global Core Imports (Rate Limiters, CSRF, Validation Engine)
import {
  loginLimiter,
  registerLimiter,
  changePasswordLimiter,
  verifyEmailLimiter,
  refreshTokenLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from './middlewares/rateLimiter.middleware.ts';
import {
  csrfProtection,
  issueCsrfToken,
} from '../../core/middlewares/csrf.middleware.ts';
import validate from '../../core/middlewares/validate.middleware.ts';

const router = Router();

/**
 * Middleware to normalize token location so Zod validation always succeeds
 */
const normalizeResetPasswordToken = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.body.token && typeof req.query.token === 'string') {
    req.body.token = req.query.token;
  }
  next();
};

// ---------------------------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------------------------
router.get('/csrf-token', issueCsrfToken);

router.post(
  '/register',
  csrfProtection,
  registerLimiter,
  validate(registerSchema),
  register
);

router.post(
  '/login',
  csrfProtection,
  loginLimiter,
  validate(loginSchema),
  login
);

router.post(
  '/googleoauth',
  csrfProtection,
  loginLimiter,
  validate(googleOAuthSchema),
  googleLogin
);

router.get('/verify-email', verifyEmailLimiter, verifyEmail);

router.post(
  '/send-otp',
  csrfProtection,
  validate(sendOtpSchema),
  sendOtpHandler
);

router.post(
  '/verify-otp',
  csrfProtection,
  validate(verifyOtpSchema),
  verifyOtpHandler
);

router.post(
  '/forgot-password',
  csrfProtection,
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

router.post(
  '/reset-password',
  csrfProtection,
  resetPasswordLimiter,
  normalizeResetPasswordToken,
  validate(resetPasswordSchema),
  resetPassword
);

router.post(
  '/refresh-token',
  csrfProtection,
  refreshTokenLimiter,
  refreshToken
);

// ---------------------------------------------------------------------------
// PROTECTED ROUTES (Requires valid Access Token)
// ---------------------------------------------------------------------------
router.post(
  '/change-password',
  csrfProtection,
  changePasswordLimiter,
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

router.post('/logout', csrfProtection, authenticate, logout);

router.post(
  '/logout-all-sessions',
  csrfProtection,
  authenticate,
  logoutAllSessions
);

// Changed to DELETE to match REST conventions for removing a resource
router.delete(
  '/sessions/:sessionId',
  csrfProtection,
  authenticate,
  logoutSession
);

router.get('/sessions', authenticate, getSessions);

export default router;
