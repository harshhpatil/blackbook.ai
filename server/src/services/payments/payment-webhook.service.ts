import crypto from 'node:crypto';

// function to verify the webhook signature using HMAC SHA256
export function verifyWebhookSignature(
  payload: Buffer,
  signature: string
): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('PAYMENT_WEBHOOK_SECRET is missing');
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature);

  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

// function to hash the payload using SHA256
export function hashPayload(payload: Buffer): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}
