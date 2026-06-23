import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.ts';
import { verifyPaymentSchema } from '../utils/validation.ts';
import validate from '../middlewares/validate.middleware.ts';
import {
  createCheckoutController,
  verifyPaymentController,
  paymentWebhookController,
} from '../controllers/payment.controller.ts';

const router = Router();

router.post('/checkout', authenticate, createCheckoutController);
router.post(
  '/verify',
  authenticate,
  validate(verifyPaymentSchema),
  verifyPaymentController
);
router.post('/webhook', paymentWebhookController);

export default router;
