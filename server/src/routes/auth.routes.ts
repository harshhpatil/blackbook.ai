import { Router } from 'express';
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
} from '../controllers/auth.controller.ts';
import {
  loginLimiter,
  registerLimiter,
  changePasswordLimiter,
  verifyEmailLimiter,
  refreshTokenLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from '../middlewares/rateLimiter.middleware.ts';
import { authenticate } from '../middlewares/auth.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validation.ts';

const router = Router();

const normalizeResetPasswordToken = (
  req: any,
  _res: any,
  next: any
): void => {
  if (!req.body.token && typeof req.query.token === 'string') {
    req.body.token = req.query.token;
  }

  next();
};

// defining the auth routes
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/register', registerLimiter, validate(registerSchema), register);
router.post(
  '/change-password',
  changePasswordLimiter,
  authenticate,
  validate(changePasswordSchema),
  changePassword
);
router.post('/refresh-token', refreshTokenLimiter, refreshToken);
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
router.post(
  '/reset-password',
  resetPasswordLimiter,
  normalizeResetPasswordToken,
  validate(resetPasswordSchema),
  resetPassword
);
router.post('/logout', authenticate, logout);
router.post('/logout-all-sessions', authenticate, logoutAllSessions);
router.post('/logout-session/:sessionId', authenticate, logoutSession);

router.get('/sessions', authenticate, getSessions);
router.get('/verify-email', verifyEmailLimiter, verifyEmail);

export default router;
