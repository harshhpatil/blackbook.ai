import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.ts';
import { csrfProtection } from '../middlewares/csrf.middleware.ts';
import { verifyPaymentSchema, checkoutSchema } from '../utils/validation.ts';
import validate from '../middlewares/validate.middleware.ts';
import {
  createCheckoutController,
  verifyPaymentController,
  paymentWebhookController,
  getOrdersController,
  getSingleOrderController,
} from '../controllers/payment.controller.ts';

const router = Router();

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
router.post('/webhook', paymentWebhookController);

export default router;
