import { Router } from 'express';

// Global Core & Auth Middlewares (Adjust paths based on your actual folder structure)
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';
import validate from '../../core/middlewares/validate.middleware.ts';

// Local Module Imports
import { verifyPaymentSchema, checkoutSchema } from './utils/validation.ts';
import {
  createCheckoutController,
  verifyPaymentController,
  paymentWebhookController,
  getOrdersController,
  getSingleOrderController,
} from './controllers/payment.controller.ts';

const router = Router();

// ---------------------------------------------------------------------------
// PROTECTED API ROUTES (Requires User Session & CSRF)
// ---------------------------------------------------------------------------
router.post(
  '/checkout',
  authenticate,
  csrfProtection,
  validate(checkoutSchema),
  createCheckoutController
);

router.post(
  '/verify',
  authenticate,
  csrfProtection,
  validate(verifyPaymentSchema),
  verifyPaymentController
);

router.get('/orders', authenticate, getOrdersController);

router.get('/orders/:orderId', authenticate, getSingleOrderController);

// ---------------------------------------------------------------------------
// SERVER-TO-SERVER ROUTES (No Session, No CSRF, Uses Signature Verification)
// ---------------------------------------------------------------------------
router.post(
  '/webhook',
  // IMPORTANT: Ensure your main app.ts uses express.raw({ type: 'application/json' })
  // specifically for this route so req.rawBody is populated correctly!
  paymentWebhookController
);

export default router;
