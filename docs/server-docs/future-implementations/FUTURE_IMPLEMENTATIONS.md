# Future Implementations

This roadmap starts after the backend audit remediation pass. The API now has
cookie auth, CSRF protection, session-bound JWTs, Redis-backed rate limiting,
typed environment validation, Mongo-backed email outbox records, readiness
checks, and graceful shutdown.

## P0: Frontend Integration

- Build auth screens from the [Frontend Integration Guide](../frontend/FRONTEND_AUTH_INTEGRATION.md).
- Add a small frontend API client that always sends `credentials: 'include'`.
- Load and cache CSRF token on app startup.
- Implement refresh-once retry behavior for authenticated calls.
- Add session management UI using `GET /api/v1/auth/sessions`.

## P1: Backend Test Coverage

- Add route integration tests for register, verify, login, refresh, logout,
  password change, forgot password, and reset password.
- Add CSRF and CORS tests.
- Add session-bound JWT revocation tests.
- Add transaction/race tests for refresh, verify, reset, change password, and
  logout-all.
- Add worker/outbox tests for duplicate jobs, malformed jobs, retry, and failed
  Redis/SMTP behavior.

## P1: API Contract Quality

- Generate an OpenAPI document from the Express route contracts or maintain a
  checked-in contract manually.
- Keep the Requestly collection aligned with cookie auth and CSRF requirements.
- Add response DTOs so controllers return predictable shapes.
- Normalize response message casing before frontend polish.

## P1: Delivery Reliability

- Add an outbox polling loop or scheduled worker pass rather than publishing
  only on worker startup and immediate request completion.
- Track email delivery state without storing raw reset or verification links.
- Add a dead-letter inspection and replay tool for failed outbox events.
- Add user-facing resend verification with cooldowns and neutral responses.

## P1: Observability

- Add structured JSON logging with request IDs.
- Redact emails, tokens, reset links, cookies, and provider error details.
- Track route latency, auth failures, queue depth, outbox age, job failures, and
  dependency readiness.
- Alert on password-reset spikes, queue backlog, refresh replay failures, and
  readiness failures.

## P2: Security Features

- Add MFA using TOTP or WebAuthn.
- Add security notifications for password changes, password resets, and new
  device/session login.
- Add optional breached-password screening.
- Define account disable/delete behavior and enforce it in auth middleware.
- Add Helmet and coordinate a frontend Content Security Policy.

## P2: Deployment And Operations

- Standardize on one package manager and one lockfile.
- Add CI for build, lint, tests, dependency audit, and secret scanning.
- Containerize API and worker processes.
- Move secrets into a deployment secret manager.
- Use managed MongoDB and Redis with TLS, backups, point-in-time recovery, and
  tested restore procedures.
- Run index creation/migration as a controlled deployment step.

## P3: Product Improvements

- Add current-session indicator and friendly device names.
- Add security event history sourced from audit records.
- Add user notification preferences for non-security email.
- Add admin-only diagnostics behind network policy or admin auth.

