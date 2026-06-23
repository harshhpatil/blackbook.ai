# Blackbook.ai Backend Docs

This folder documents the current backend API, frontend integration contracts,
audit remediation, and planned backend work.

## Start Here

- [Frontend Integration Guide](./frontend/FRONTEND_AUTH_INTEGRATION.md): auth routes, cookies, CSRF, payloads, frontend flows, and implementation notes.
- [Payment Integration Roadmap](./payments/PAYMENT_INTEGRATION_ROADMAP.md): phased backend roadmap for adding checkout, payment orders, webhooks, idempotency, and subscriptions.
- [Backend Audit Remediation Report](./audits/BACKEND_AUDIT_REMEDIATION_REPORT.md): what was fixed from the backend audit and what still needs operational follow-up.
- [Original Backend Audit Report](./audits/BACKEND_AUDIT_REPORT.md): original findings and risk context.
- [Future Implementations](./future-implementations/FUTURE_IMPLEMENTATIONS.md): post-auth roadmap items.

## Current Backend Shape

The backend lives in `server/` and exposes an Express authentication API under:

```text
/api/v1/auth
```

Health endpoints:

```text
GET /api/health
GET /api/ready
```

Runtime processes:

- API process: `npm run dev` for local development, `npm run build && npm start` for built output.
- Email worker: `npm run worker`.

Auth state is cookie-based. The frontend must send requests with credentials enabled and must include an `x-csrf-token` header for mutating auth requests.

## Environment

Use `server/.env.template` as the source of required variables. Important frontend-facing values:

- `CLIENT_URL`: frontend base URL used for verification/reset links.
- `CORS_ORIGINS`: comma-separated allowed browser origins.
- `CROSS_SITE_COOKIES`: keep `false` for same-site/local development unless deploying API and frontend cross-site.
- `JWT_ISSUER` and `JWT_AUDIENCE`: JWT validation policy.

## Verification

The backend currently passes:

```bash
cd server
npm run build
```

There are still no automated integration tests. Treat the docs here as the manual contract until tests or generated OpenAPI docs are added.
