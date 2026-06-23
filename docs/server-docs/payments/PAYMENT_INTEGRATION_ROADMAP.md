# Payment Integration Roadmap

Scope: implement payment support inside `server/` without weakening the existing auth, CSRF, session, audit, queue, and readiness architecture.

This roadmap is provider-neutral. Use it with Stripe, Razorpay, Cashfree, PayPal, or another provider by implementing a provider adapter behind the same internal payment service contract.

## Goals

- Create payment checkout/order flows from authenticated users.
- Verify all payment state changes from provider webhooks, not from frontend redirects.
- Store local payment/subscription state in MongoDB.
- Make payment operations idempotent and auditable.
- Keep secrets server-side only.
- Give the frontend simple routes for starting checkout and reading payment state.

## Non-Goals For First Pass

- No multi-provider routing.
- No marketplace/split-payment logic.
- No wallet, stored card, or PCI-sensitive card collection.
- No admin refund dashboard unless explicitly required.
- No frontend-only payment confirmation as source of truth.

## Phase 0: Product Decisions

Decide these before writing code:

- Provider: Stripe, Razorpay, Cashfree, PayPal, or other.
- Payment type: one-time purchases, subscriptions, credits, invoices, or usage-based billing.
- Currency and tax behavior.
- Refund/cancellation policy.
- What a successful payment unlocks in the product.
- Whether users can have multiple active plans.
- Whether checkout should redirect to hosted provider pages or embed provider UI.

Recommended first version:

- Hosted checkout page from provider.
- One-time payment or simple subscription.
- Backend receives webhook and updates local state.
- Frontend only displays status and redirects.

## Phase 1: Environment And Config

Add provider configuration to `server/src/config/env.ts` and `server/.env.template`.

Suggested variables:

```text
PAYMENT_PROVIDER=stripe
PAYMENT_WEBHOOK_SECRET=replace-with-provider-webhook-secret
PAYMENT_SUCCESS_URL=http://localhost:5173/payments/success
PAYMENT_CANCEL_URL=http://localhost:5173/payments/cancel
PAYMENT_DEFAULT_CURRENCY=usd
```

Provider-specific examples:

```text
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_PRICE_ID=price_placeholder
```

or:

```text
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=replace-with-secret
```

Rules:

- Never expose secret keys to the frontend.
- Public provider keys can be exposed only through frontend env variables if the provider requires them.
- Validate all required payment env variables at startup.

## Phase 2: Data Models

Add payment-specific models under `server/src/models/`.

### PaymentCustomer

Maps a local user to a provider customer/account.

Fields:

- `user`: ObjectId ref `User`, unique.
- `provider`: string.
- `providerCustomerId`: string.
- timestamps.

Indexes:

- `{ user: 1, provider: 1 }` unique.
- `{ provider: 1, providerCustomerId: 1 }` unique.

### PaymentOrder

Tracks one checkout/payment attempt.

Fields:

- `user`: ObjectId ref `User`.
- `provider`: string.
- `providerCheckoutId`: string.
- `providerPaymentId`: string optional.
- `amount`: number in smallest currency unit.
- `currency`: string.
- `status`: `created | pending | paid | failed | canceled | refunded`.
- `purpose`: product-specific string, such as `subscription`, `credits`, or `plan_upgrade`.
- `metadata`: safe internal metadata.
- `idempotencyKey`: string.
- timestamps.

Indexes:

- `{ user: 1, createdAt: -1 }`.
- `{ provider: 1, providerCheckoutId: 1 }` unique sparse.
- `{ idempotencyKey: 1 }` unique.

### Subscription

Add only if subscription billing is needed.

Fields:

- `user`: ObjectId ref `User`.
- `provider`: string.
- `providerSubscriptionId`: string.
- `providerCustomerId`: string.
- `status`: `incomplete | active | past_due | canceled | unpaid`.
- `planId`: string.
- `currentPeriodStart`: Date.
- `currentPeriodEnd`: Date.
- `cancelAtPeriodEnd`: boolean.
- timestamps.

Indexes:

- `{ user: 1, status: 1 }`.
- `{ provider: 1, providerSubscriptionId: 1 }` unique.

### PaymentWebhookEvent

Stores provider events for idempotency and audit.

Fields:

- `provider`: string.
- `providerEventId`: string.
- `eventType`: string.
- `processedAt`: Date optional.
- `status`: `received | processed | failed`.
- `error`: string optional.
- `payloadHash`: string.
- timestamps.

Indexes:

- `{ provider: 1, providerEventId: 1 }` unique.
- `{ status: 1, createdAt: 1 }`.

## Phase 3: Provider Adapter

Create a provider abstraction so controllers do not depend directly on SDK details.

Suggested files:

```text
server/src/services/payments/paymentProvider.ts
server/src/services/payments/stripeProvider.ts
server/src/services/payments/razorpayProvider.ts
server/src/services/payments/payment.service.ts
```

Provider interface:

```ts
export interface CreateCheckoutParams {
  userId: string;
  email: string;
  amount?: number;
  currency: string;
  purpose: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  provider: string;
  checkoutId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
}

export interface VerifiedWebhook {
  provider: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}

export interface PaymentProvider {
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;
  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): VerifiedWebhook;
}
```

Implementation rule:

- Controllers call `payment.service.ts`.
- `payment.service.ts` calls the selected provider adapter.
- Provider adapters are the only files that import provider SDKs.

## Phase 4: Routes

Add:

```text
server/src/controllers/payment.controller.ts
server/src/routes/payment.routes.ts
```

Mount under:

```text
/api/v1/payments
```

### Create Checkout

```http
POST /api/v1/payments/checkout
```

Auth:

- Requires `authenticate`.
- Requires CSRF token.

Body for one-time payment:

```json
{
  "purpose": "credits",
  "amount": 999,
  "currency": "usd"
}
```

Body for fixed provider price:

```json
{
  "purpose": "subscription",
  "planId": "pro_monthly"
}
```

Response:

```json
{
  "checkoutUrl": "https://provider-checkout-url",
  "orderId": "localPaymentOrderId"
}
```

Frontend behavior:

- Call this route.
- Redirect browser to `checkoutUrl`.
- Do not mark payment as successful yet.

### Get Payment Order

```http
GET /api/v1/payments/orders/:orderId
```

Auth:

- Requires `authenticate`.

Response:

```json
{
  "order": {
    "_id": "localPaymentOrderId",
    "status": "paid",
    "amount": 999,
    "currency": "usd",
    "purpose": "credits",
    "createdAt": "2026-06-20T12:00:00.000Z"
  }
}
```

Frontend behavior:

- On success redirect page, poll this endpoint until status becomes `paid`, `failed`, or `canceled`.

### List My Payment Orders

```http
GET /api/v1/payments/orders
```

Auth:

- Requires `authenticate`.

Query:

```text
?limit=20&page=1
```

Response:

```json
{
  "orders": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

### Provider Webhook

```http
POST /api/v1/payments/webhook
```

Auth:

- No user auth.
- No CSRF.
- Must verify provider webhook signature using the raw request body.

Important:

- This route must be mounted before JSON body parsing or use route-specific raw body parsing.
- Never trust frontend success redirects as proof of payment.
- Store every provider event in `PaymentWebhookEvent`.
- Ignore duplicate provider event IDs.

## Phase 5: Express Raw Body Handling

Provider webhook signature verification usually needs the exact raw request body.

Recommended `app.ts` route order:

```ts
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), paymentWebhookRoute);
app.use(express.json());
```

Keep normal JSON parsing for all other routes.

## Phase 6: Validation

Add Joi schemas under `server/src/utils/validation.ts` or a new payment validation file.

Schemas:

- `createCheckoutSchema`
- `listPaymentOrdersQuerySchema`
- `cancelSubscriptionSchema` if needed

Validation rules:

- Amount must be integer smallest currency unit.
- Currency must be lowercase ISO currency code.
- Purpose must be an allowed enum.
- Plan IDs must be server-known values, not arbitrary provider price IDs from the client.

## Phase 7: Webhook State Machine

Webhook handling should be the source of truth.

Example event mapping:

| Provider event meaning | Local update |
| --- | --- |
| checkout completed/payment succeeded | `PaymentOrder.status = paid` |
| checkout expired/canceled | `PaymentOrder.status = canceled` |
| payment failed | `PaymentOrder.status = failed` |
| refund created/succeeded | `PaymentOrder.status = refunded` |
| subscription active | `Subscription.status = active` |
| subscription past due | `Subscription.status = past_due` |
| subscription canceled | `Subscription.status = canceled` |

Webhook transaction:

1. Verify signature.
2. Insert `PaymentWebhookEvent` with unique provider event ID.
3. If duplicate key, return `200` immediately.
4. Apply local state changes in a MongoDB transaction.
5. Mark webhook event `processed`.
6. Audit the payment event.

## Phase 8: Idempotency

Use idempotency everywhere payment money can move.

- Frontend sends an `Idempotency-Key` header for checkout creation, or backend creates one from user + purpose + plan + time window.
- Store local `PaymentOrder.idempotencyKey`.
- Pass idempotency key to provider if supported.
- Webhook events are deduped by provider event ID.

## Phase 9: Audit And Email

Add audit events:

- `payment_checkout_created`
- `payment_succeeded`
- `payment_failed`
- `payment_refunded`
- `subscription_created`
- `subscription_canceled`

Optional emails through existing email outbox:

- Payment receipt
- Payment failure
- Subscription canceled
- Refund confirmation

Do not email raw provider payloads or sensitive payment details.

## Phase 10: Frontend Contract

Frontend payment flow:

1. User clicks upgrade/buy.
2. Frontend calls `POST /api/v1/payments/checkout` with CSRF and credentials.
3. Backend returns `checkoutUrl`.
4. Frontend redirects to `checkoutUrl`.
5. Provider redirects back to success or cancel URL.
6. Frontend does not assume success.
7. Frontend polls `GET /api/v1/payments/orders/:orderId` or calls subscription status.
8. UI unlocks paid state only after backend reports paid/active.

## Phase 11: Testing

Required integration tests:

- Auth required for checkout creation.
- CSRF required for checkout creation and subscription cancellation.
- Checkout creates local order and provider checkout.
- Duplicate checkout idempotency returns same local order.
- Webhook rejects invalid signature.
- Webhook processes valid payment success.
- Duplicate webhook event is ignored safely.
- Failed/canceled/refunded event updates local state correctly.
- User cannot read another user's payment order.

Manual sandbox tests:

- Successful payment.
- Failed payment.
- Canceled checkout.
- Duplicate webhook replay.
- Refund event.
- Subscription renewal/cancel if applicable.

## Phase 12: Deployment Checklist

- Use provider sandbox keys locally and in staging.
- Register webhook endpoint in provider dashboard.
- Store webhook secret in deployment secrets.
- Confirm raw body signature verification in deployed environment.
- Ensure HTTPS for public webhook URL.
- Ensure logs redact provider secrets and payloads.
- Add alerting for failed webhooks and unpaid/past-due subscription spikes.
- Backfill indexes before launch.
- Run provider test cards/test payment methods before production keys.

## Suggested Implementation Order

1. Add env variables and typed config validation.
2. Add payment models and indexes.
3. Add provider adapter interface.
4. Implement one provider adapter in sandbox mode.
5. Add checkout creation route.
6. Add local order read/list routes.
7. Add webhook route with raw body verification.
8. Add webhook state machine and idempotency.
9. Add audit events and optional email notifications.
10. Add frontend integration docs for payment screens.
11. Add integration tests.
12. Enable sandbox testing with provider dashboard.
13. Move to production keys only after test coverage and webhook observability are in place.
