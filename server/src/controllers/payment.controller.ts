import { Request, Response, NextFunction } from 'express';
import {
  createCheckout,
  verifyPayment,
} from '../services/payments/payment.service.ts';
import { PaymentOrder } from '../models/PaymentOrder.model.ts';
import { PaymentWebhookEvent } from '../models/PaymentWebhook.model.ts';
import { Audit } from '../models/Audit.model.ts';
import {
  verifyWebhookSignature,
  hashPayload,
} from '../services/payments/payment-webhook.service.ts';
import { createLogger } from '../lib/logger.ts';
import { grantCreditsForPayment } from '../services/credit.service.ts';

const log = createLogger('payment-controller');

const isDuplicateKeyError = (err: unknown): err is { code: number } => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 11000
  );
};

// -------------------------
// CREATE CHECKOUT
// -------------------------
export async function createCheckoutController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { amount, currency, purpose, idempotencyKey } = req.body;

    if (!amount || !currency || !purpose || !idempotencyKey) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    // initial check
    const existingOrder = await PaymentOrder.findOne({
      idempotencyKey,
      user: req.user.id,
    });
    if (existingOrder) {
      return res
        .status(200)
        .json({ message: 'Order already initiated', order: existingOrder });
    }

    // attempt creation of a new order
    try {
      const result = await createCheckout({
        userId: req.user.id,
        amount,
        currency,
        purpose,
        idempotencyKey,
      });

      // LOG AUDIT EVENT: Checkout Created
      await Audit.create({
        user: req.user.id,
        event: 'payment_checkout_created',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        meta: {
          orderId: result.order._id,
          razorpayOrderId: result.razorpayOrder.id,
          amount,
          currency,
        },
      });

      return res.status(201).json({
        success: true,
        orderId: result.order._id,
        razorpayOrderId: result.razorpayOrder.id,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (creationError) {
      // the race condition catcher
      // If MongoDB throws a Duplicate Key Error (11000) on the idempotencyKey, we know a concurrent request beat us to it.
      if (isDuplicateKeyError(creationError)) {
        const concurrentOrder = await PaymentOrder.findOne({
          idempotencyKey,
          user: req.user.id,
        });
        return res.status(200).json({
          message: 'order already initiated (caught concurrent request)',
          order: concurrentOrder,
        });
      }
      throw creationError; // If it's a different error, pass it down
    }
  } catch (error) {
    next(error);
  }
}

// -------------------------
// VERIFY PAYMENT (CLIENT CALLBACK)
// -------------------------
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
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.status === 'paid') {
      await grantCreditsForPayment(order._id.toString());
      return res.status(200).json({
        success: true,
        message: 'Already verified',
        order,
      });
    }

    const isValid = await verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      order.status = 'failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    order.status = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;

    await order.save();
    await grantCreditsForPayment(order._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Payment verified',
      order,
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------
// WEBHOOK CONTROLLER
// -------------------------
export async function paymentWebhookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let webhookEvent: InstanceType<typeof PaymentWebhookEvent> | null = null;
  try {
    // razorpay sends the signature in the header 'x-razorpay-signature' receiving and validating it
    const signature = req.headers['x-razorpay-signature'];

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Missing webhook signature',
      });
    }

    if (!req.rawBody) {
      return res.status(400).json({
        success: false,
        message: 'missing the raw body',
      });
    }

    // verify the signature using the raw body and the signature in the headers
    const isValid = verifyWebhookSignature(req.rawBody, signature);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    // parsing the payload and extracting the event type and provider event id
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(req.rawBody.toString()) as Record<string, unknown>;
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid webhook JSON' });
    }

    const eventType = typeof payload.event === 'string' ? payload.event : '';
    if (!eventType) return res.status(400).json({ success: false, message: 'Missing webhook event type' });

    const payloadHash = hashPayload(req.rawBody);
    const headerEventId = req.headers['x-razorpay-event-id'];
    const providerEventId = typeof headerEventId === 'string' && headerEventId
      ? headerEventId
      : `payload-${payloadHash}`;

    try {
      webhookEvent = await PaymentWebhookEvent.create({
        provider: 'razorpay', providerEventId, eventType, payloadHash, status: 'received',
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existingEvent = await PaymentWebhookEvent.findOne({ providerEventId });
      if (!existingEvent || existingEvent.status === 'processed') {
        return res.status(200).json({ success: true, message: 'webhook already processed' });
      }
      existingEvent.status = 'received';
      existingEvent.error = undefined;
      webhookEvent = await existingEvent.save();
    }

    const body = payload.payload as Record<string, unknown> | undefined;
    const payment = body?.payment as { entity?: { order_id?: string; id?: string } } | undefined;
    const order = body?.order as { entity?: { id?: string; payment_id?: string } } | undefined;
    const razorpayOrderId = payment?.entity?.order_id ?? order?.entity?.id;
    const razorpayPaymentId = payment?.entity?.id ?? order?.entity?.payment_id;

    if (!['payment.captured', 'payment.failed', 'order.paid'].includes(eventType)) {
      webhookEvent.status = 'processed';
      await webhookEvent.save();
      log.info({ providerEventId, eventType }, 'ignored unsupported payment webhook event');
      return res.status(200).json({ success: true, message: 'event ignored' });
    }

    if (!razorpayOrderId) {
      throw new Error(`Webhook ${eventType} did not contain a Razorpay order id`);
    }

    const isPaidEvent = eventType === 'payment.captured' || eventType === 'order.paid';
    const updatedOrder = await PaymentOrder.findOneAndUpdate(
      isPaidEvent
        ? { razorpayOrderId, status: { $ne: 'paid' } }
        : { razorpayOrderId, status: { $nin: ['paid', 'failed'] } },
      { $set: { status: isPaidEvent ? 'paid' : 'failed', ...(razorpayPaymentId ? { razorpayPaymentId } : {}) } },
      { new: true }
    );

    const paidOrder = isPaidEvent
      ? updatedOrder ?? await PaymentOrder.findOne({ razorpayOrderId, status: 'paid' })
      : null;
    if (paidOrder) {
      await grantCreditsForPayment(paidOrder._id.toString());
    }

    if (updatedOrder) {
      await Audit.create({
        user: updatedOrder.user,
        event: isPaidEvent ? 'webhook_payment_paid' : 'webhook_payment_failed',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        meta: { razorpayOrderId, razorpayPaymentId, eventId: providerEventId, eventType },
      });
    } else {
      log.warn({ providerEventId, eventType, razorpayOrderId }, 'webhook did not change a payment order');
    }

    webhookEvent.status = 'processed';
    await webhookEvent.save();
    return res.status(200).json({ success: true });
  } catch (error) {
    if (webhookEvent) {
      webhookEvent.status = 'failed';
      webhookEvent.error = error instanceof Error ? error.message : 'unknown webhook error';
      await webhookEvent.save().catch(() => undefined);
    }
    next(error);
  }
}

// fetch all orders for the authenticated user (with pagination & sorting)
export async function getOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // parse pagination query params, default to page 1, 10 items per page
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // fetch orders strictly belonging to the logged-in user
    const orders = await PaymentOrder.find({ user: req.user.id })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);

    // get total count for frontend pagination UI
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

// fetch a single order by ID (with strict ownership validation)
export async function getSingleOrderController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { orderId } = req.params;

    const order = await PaymentOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Payment order not found',
      });
    }

    // AUTHORIZATION HARDENING: Ensure the user actually owns this order
    // Using .toString() because MongoDB ObjectIds are technically objects
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'unauthorized access to this payment order',
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}
