import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

import {
  createCheckout,
  verifyPayment,
} from '../services/payments/payment.service.ts';

import { PaymentOrder } from '../models/PaymentOrder.model.ts';
import { PaymentWebhookEvent } from '../models/PaymentWebhook.model.ts';

import {
  verifyWebhookSignature,
  hashPayload,
} from '../services/payments/payment-webhook.service.ts';

// -------------------------
// CREATE CHECKOUT
// -------------------------
export async function createCheckoutController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { amount, currency, purpose } = req.body;

    if (!amount || !currency || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Amount, currency, and purpose are required',
      });
    }

    const result = await createCheckout({
      userId: req.user.id,
      amount,
      currency,
      purpose,
    });

    return res.status(201).json({
      success: true,
      orderId: result.order._id,
      razorpayOrderId: result.razorpayOrder.id,
      amount: result.razorpayOrder.amount,
      currency: result.razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

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
  try {
    console.log('WEBHOOK HIT');

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
        message: 'Missing raw body',
      });
    }

    const isValid = verifyWebhookSignature(req.rawBody, signature);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    const payload = JSON.parse(req.rawBody.toString());
    const eventType = payload.event;

    // ✅ FIX: correct webhook event id (IMPORTANT)
    const providerEventId =
      (req.headers['x-razorpay-event-id'] as string) ??
      crypto.randomUUID();

    const existingEvent = await PaymentWebhookEvent.findOne({
      providerEventId,
    });

    if (existingEvent) {
      return res.status(200).json({
        success: true,
        message: 'Webhook already processed',
      });
    }

    const webhookEvent = await PaymentWebhookEvent.create({
      provider: 'razorpay',
      providerEventId,
      eventType,
      payloadHash: hashPayload(req.rawBody),
      status: 'received',
    });

    // -------------------------
    // EVENT HANDLING
    // -------------------------

    if (eventType === 'payment.captured') {
      const payment = payload.payload.payment.entity;

      console.log('WEBHOOK ORDER ID:', payment.order_id);

      const updatedOrder = await PaymentOrder.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        {
          $set: {
            status: 'paid',
            razorpayPaymentId: payment.id,
          },
        },
        { new: true }
      );

      console.log('UPDATED ORDER:', updatedOrder);
    }

    if (eventType === 'payment.failed') {
      const payment = payload.payload.payment.entity;

      await PaymentOrder.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        {
          $set: {
            status: 'failed',
            razorpayPaymentId: payment.id,
          },
        }
      );
    }

    if (eventType === 'order.paid') {
      const payment = payload.payload.payment.entity;

      await PaymentOrder.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        {
          $set: {
            status: 'paid',
            razorpayPaymentId: payment.id,
          },
        }
      );
    }

    webhookEvent.status = 'processed';
    await webhookEvent.save();

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
}