import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { createCheckout, verifyPayment } from '../services/payment.service.ts';
import {
  verifyWebhookSignature,
  hashPayload,
  processRazorpayWebhook,
} from '../services/payment-webhook.service.ts';
import { changeUserPlan } from '../services/subscription.service.ts';
import { PaymentOrder } from '../models/PaymentOrder.model.ts';
import { Audit } from '../../system_module/models/Audit.model.ts';
import { env } from '../../../core/config/env.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('payment-controller');

const isDuplicateKeyError = (err: unknown): err is { code: number } => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 11000
  );
};

/**
 * @function createCheckoutController
 * @description Initializes a Razorpay order for a subscription purchase.
 */
export async function createCheckoutController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Now including planPurchased to align with the subscription model
    const { amount, currency, purpose, idempotencyKey, planPurchased } =
      req.body;

    if (!amount || !currency || !purpose || !idempotencyKey || !planPurchased) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    const existingOrder = await PaymentOrder.findOne({
      idempotencyKey,
      user: req.user.id,
    });

    if (existingOrder) {
      return res
        .status(200)
        .json({ message: 'Order already initiated', order: existingOrder });
    }

    try {
      const result = await createCheckout({
        userId: req.user.id,
        amount,
        currency,
        purpose,
        idempotencyKey,
        planPurchased,
      });

      await Audit.create({
        user: req.user.id,
        event: 'payment_checkout_created',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        meta: {
          orderId: result.order._id,
          razorpayOrderId: result.razorpayOrder.id,
          planPurchased,
        },
      });

      return res.status(201).json({
        success: true,
        orderId: result.order._id,
        razorpayOrderId: result.razorpayOrder.id,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        keyId: env.RAZORPAY_KEY_ID,
      });
    } catch (creationError) {
      if (isDuplicateKeyError(creationError)) {
        const concurrentOrder = await PaymentOrder.findOne({
          idempotencyKey,
          user: req.user.id,
        });
        return res.status(200).json({
          message: 'Order already initiated (caught concurrent request)',
          order: concurrentOrder,
        });
      }
      throw creationError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * @function verifyPaymentController
 * @description Frontend callback verification. Uses Mongoose transactions to safely grant the subscription.
 */
export async function verifyPaymentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const order = await PaymentOrder.findOne({
      razorpayOrderId: razorpay_order_id,
      user: req.user.id,
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    // If webhook beat the frontend to this point, just return success
    if (order.status === 'paid') {
      return res
        .status(200)
        .json({ success: true, message: 'Already verified', order });
    }

    const isValid = verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      order.status = 'failed';
      await order.save();
      return res
        .status(400)
        .json({ success: false, message: 'Invalid signature' });
    }

    const mongoSession = await mongoose.startSession();
    await mongoSession.withTransaction(async () => {
      // 1. Mark order as paid
      order.status = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.planGrantedAt = new Date();
      await order.save({ session: mongoSession });

      // 2. Grant the subscription plan securely
      await changeUserPlan(
        order.user,
        order.planPurchased,
        'upgrade',
        razorpay_payment_id,
        mongoSession
      );
    });
    await mongoSession.endSession();

    return res
      .status(200)
      .json({ success: true, message: 'Payment verified', order });
  } catch (error) {
    next(error);
  }
}

/**
 * @function paymentWebhookController
 * @description Server-to-server webhook endpoint. Defers logic to processRazorpayWebhook service.
 */
export async function paymentWebhookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const signature = req.headers['x-razorpay-signature'];

    if (!signature || typeof signature !== 'string') {
      return res
        .status(400)
        .json({ success: false, message: 'Missing webhook signature' });
    }

    if (!req.rawBody) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing raw body' });
    }

    // 1. Verify the cryptographic signature using the raw Buffer
    const isValid = verifyWebhookSignature(req.rawBody, signature);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid signature' });
    }

    // 2. Parse payload and let the service handle idempotency and transactions
    const payload = JSON.parse(req.rawBody.toString());
    const payloadHash = hashPayload(req.rawBody);

    await processRazorpayWebhook(payload, payloadHash);

    // Always respond 200 OK so Razorpay knows we received it and doesn't retry
    return res.status(200).json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'Webhook processing failed');
    next(error);
  }
}

/**
 * @function getOrdersController
 * @description Fetches paginated order history for the authenticated user.
 */
export async function getOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const orders = await PaymentOrder.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await PaymentOrder.countDocuments({
      user: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total: totalOrders,
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @function getSingleOrderController
 * @description Fetches a specific order, strictly validating ownership.
 */
export async function getSingleOrderController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { orderId } = req.params;
    const order = await PaymentOrder.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment order not found' });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this payment order',
      });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}
