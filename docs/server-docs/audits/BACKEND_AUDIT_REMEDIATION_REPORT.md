# Backend Audit Remediation Report

Remediation date: 2026-06-20

Source audit: `docs/server-docs/audits/BACKEND_AUDIT_REPORT.md`

Verification performed after remediation:

- `npm run build` from `server/` passes.
- Targeted search confirmed the old global token-scan patterns were removed from auth controllers.
- Second-pass remediation also passed `npm run build` from `server/`.

## Fixed Findings

### H-03: Refresh token exposed in login response

Status: Fixed

The login endpoint now keeps the refresh token only in the HTTP-only cookie and returns only non-sensitive response metadata.

Affected files:

- `server/src/controllers/auth/login.controller.ts`

### H-04: Refresh rotation is non-atomic and lacks replay protection

Status: Fixed for single-session concurrent rotation

Refresh now computes the presented token hash directly and rotates with `findOneAndUpdate` using the old hash, active session state, and expiry in the selector. Only one concurrent refresh can win for a given token.

Affected files:

- `server/src/controllers/auth/session.controller.ts`
- `server/src/models/Session.model.ts`

Remaining architectural work:

- Token-family reuse detection and family-wide revocation are still future hardening items.

### H-05: Token and session verification performs global collection scans

Status: Fixed

Email verification, password reset, refresh, and logout now query directly by deterministic SHA-256 token hash instead of loading all candidate users or sessions and comparing in application code.

Affected files:

- `server/src/controllers/auth/account.controller.ts`
- `server/src/controllers/auth/password.controller.ts`
- `server/src/controllers/auth/session.controller.ts`
- `server/src/models/Users.model.ts`
- `server/src/models/Session.model.ts`

### H-06: Password reset tokens can be consumed concurrently

Status: Fixed

Password reset now atomically claims and clears the matching unexpired reset token before updating the password and revoking sessions.

Affected files:

- `server/src/controllers/auth/password.controller.ts`
- `server/src/models/Users.model.ts`

### H-08: Error status mapping is broken

Status: Fixed

`AuthError` now exposes both `statusCode` and `status`, and the global error handler reads either property safely. Expected auth errors now return their intended 4xx/5xx status instead of falling through to HTTP 500.

Affected files:

- `server/src/controllers/auth/auth.helpers.ts`
- `server/src/middlewares/errorHandeler.middleware.ts`

### H-09: CORS configuration is incompatible with secure cross-origin cookies

Status: Fixed

CORS now uses an allowlist from `CLIENT_URL` and `CORS_ORIGINS`, enables credentials, and rejects unknown origins.

Affected files:

- `server/src/app.ts`
- `server/.env.template`

### H-10: Registration can create inaccessible orphan accounts

Status: Partially fixed

`CLIENT_URL` is validated before the user is created, preventing one configuration-related orphan-account path. Duplicate-key errors are also mapped to a proper conflict response.

Affected files:

- `server/src/controllers/auth/account.controller.ts`

Remaining architectural work:

- A transactional outbox or equivalent queue-publishing recovery flow is still needed to fully decouple MongoDB commits from Redis/email queue availability.
- A resend-verification endpoint is still not implemented.

### H-11: Backend cannot be built or fully type-checked

Status: Fixed

TypeScript now rewrites relative `.ts` import extensions for emitted output, and Express request augmentation declares `req.user`.

Affected files:

- `server/tsconfig.json`
- `server/src/types/express.d.ts`
- `server/src/controllers/auth/password.controller.ts`
- `server/src/controllers/auth/session.controller.ts`

## Medium Findings Fixed Or Partially Addressed

### M-01: Normal logout may reject valid sessions after the first 100

Status: Fixed

Logout now directly hashes the presented refresh token and revokes the matching active session with `findOneAndUpdate`. The global `.limit(100)` scan was removed.

Affected files:

- `server/src/controllers/auth/session.controller.ts`

### M-04: Verification is not an atomic one-time operation

Status: Fixed

Verification now atomically updates the matching unverified user and clears the verification token in one database operation before queuing the welcome email.

Affected files:

- `server/src/controllers/auth/account.controller.ts`

### M-05: Email jobs are non-idempotent and may duplicate side effects

Status: Partially fixed

Email jobs now use deterministic BullMQ job IDs derived from job name and payload, reducing duplicate enqueueing for identical logical email jobs.

Affected files:

- `server/src/services/emailQueue.service.ts`

Remaining architectural work:

- Full delivery idempotency still needs persisted sent-state or an outbox/delivery table.

### M-06: Unknown or malformed jobs can complete successfully

Status: Fixed

The email worker now validates required payload fields and throws on unknown job names, allowing malformed jobs to reach BullMQ failure handling.

Affected files:

- `server/src/workers/email.worker.ts`

### M-07: Missing session TTL and query indexes

Status: Fixed

Session TTL and compound query indexes were added for token lookup and active user session listing.

Affected files:

- `server/src/models/Session.model.ts`

### M-08: Queue failure handling can grow Redis indefinitely

Status: Fixed

Failed email jobs now have bounded retention by age and count.

Affected files:

- `server/src/services/emailQueue.service.ts`

### M-10: Environment configuration is incomplete and weakly validated

Status: Partially fixed

The environment template now documents required backend variables, including CORS and cookie policy settings.

Affected files:

- `server/.env.template`

Remaining architectural work:

- A typed startup configuration schema with cross-variable validation is still needed.

### M-13: Sensitive personal data and provider errors are logged

Status: Partially fixed

Queue and worker logs no longer include recipient email addresses, and audit write failures log only a redacted message.

Affected files:

- `server/src/controllers/auth/auth.helpers.ts`
- `server/src/services/emailQueue.service.ts`
- `server/src/workers/email.worker.ts`

Remaining architectural work:

- Full structured logging with correlation IDs and redaction policy is still needed.

### M-14: Audit failures are silently discarded

Status: Fixed

Audit write failures are now logged with a redacted operational message instead of being swallowed silently.

Affected files:

- `server/src/controllers/auth/auth.helpers.ts`

### M-16: Password policy has no maximum length and ignores bcrypt input limit

Status: Fixed

Password validation now enforces a 72-byte maximum for registration, login, change-password, and reset-password paths.

Affected files:

- `server/src/utils/validation.ts`

## Low Findings Fixed

### L-01: Session listing contradicts its active sessions contract

Status: Fixed

`GET /sessions` now returns only non-revoked, unexpired sessions.

Affected files:

- `server/src/controllers/auth/session.controller.ts`

### L-02: Constant-time comparison is not used for token hashes

Status: Fixed

The token verification helper now uses `crypto.timingSafeEqual` for equal-length hash buffers.

Affected files:

- `server/src/services/token.service.ts`

### L-03: Validation middleware does not apply normalized values

Status: Fixed

The validation middleware now assigns Joi's validated and stripped value back to `req.body`.

Affected files:

- `server/src/middlewares/validate.middleware.ts`

### L-04: Type safety is weakened throughout auth and queue code

Status: Partially fixed

Express `req.user` is typed, remaining auth controller casts were reduced, and queue payload handling is typed and validated.

Affected files:

- `server/src/types/express.d.ts`
- `server/src/controllers/auth/password.controller.ts`
- `server/src/controllers/auth/session.controller.ts`
- `server/src/workers/email.worker.ts`

## Security Controls Partially Added

### H-02: Cookie authentication has no CSRF defense

Status: Partially mitigated

Cookies now default to `SameSite=Lax`, and mutating requests validate the `Origin` header against the configured allowlist.

Affected files:

- `server/src/app.ts`
- `server/src/controllers/auth/auth.helpers.ts`
- `server/.env.template`

Remaining architectural work:

- A full CSRF token pattern is still needed if cross-site cookies are enabled.

## Not Fixed In This Pass

Second-pass remediation addressed these previously open items:

- H-01: Sanitized local Requestly fixtures by replacing real-looking emails, passwords, reset tokens, refresh tokens, and JWTs with variables/placeholders.
- H-02: Added double-submit CSRF token support via `GET /api/v1/auth/csrf-token` and `x-csrf-token` validation on mutating auth routes.
- H-07: Wrapped password change, password reset, forgot-password token rotation, registration, and verification outbox writes in MongoDB transactions.
- M-02: Bound access JWTs to a MongoDB session id and made authentication reject revoked/expired sessions.
- M-03: Replaced process-local rate limiter storage with a Redis-backed `express-rate-limit` store and added `TRUST_PROXY` configuration.
- M-09: Moved Redis creation behind lazy factory functions and added bounded Redis command/connect timeouts for API-side usage.
- M-11: Pinned JWT verification/signing to HS256 and added issuer/audience validation.
- M-12: Added a MongoDB email outbox for password reset email publication and worker-side pending outbox publication.
- M-15: Added SIGINT/SIGTERM shutdown for API and worker, closing HTTP, queue, Redis, and Mongo resources.
- M-17: Sanitized Requestly contracts, switched protected requests away from bearer tokens, added CSRF headers, and added missing `/csrf-token`, `/sessions`, and `/verify-email` entries.
- L-05: Removed the unrouted `welcomeEmail` controller and deleted unused role guard middleware.
- L-06: Added `/api/ready` readiness checks for MongoDB and Redis.
- L-07: Added startup failure handling and typed environment validation at process startup.
- L-08: Updated package runtime metadata to point `main` and `start` at emitted `dist` output.

Remaining operational follow-up:

- Rotate any credentials or tokens that were previously exposed outside the repository, because code sanitization cannot revoke already copied secrets.
- Decide whether to remove `server/package-lock.json` and standardize fully on pnpm, or regenerate it in an environment with registry access. An attempted local `npm install --package-lock-only --ignore-scripts` hung without output and was stopped.
- Add automated tests for transaction behavior, CSRF, session-bound JWT revocation, Redis rate limiting, readiness, and outbox retry semantics.
    