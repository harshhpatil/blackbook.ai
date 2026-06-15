# Future Implementations

This roadmap assumes the confirmed defects in `BACKEND_AUDIT_REPORT.md` are
fixed before feature development. Complexity is relative to the current small
backend: S (days), M (roughly one sprint), L (multiple sprints).

## Prioritized Roadmap

| Priority | Initiative | Impact | Complexity |
| --- | --- | --- | --- |
| P0 | Fix build, error statuses, exposed secrets, CORS/CSRF, and refresh-token handling | Critical production readiness | M |
| P0 | Add atomic token consumption/rotation and session indexes | Security and correctness | M |
| P0 | Add auth integration tests and CI security gates | Regression prevention | M |
| P1 | Typed configuration, DTOs, request augmentation, and job contracts | Reliability and maintainability | M |
| P1 | Distributed rate limiting and abuse controls | Security and horizontal scaling | M |
| P1 | Structured logs, metrics, tracing, and actionable alerts | Operability | M |
| P1 | Idempotent email workflows and a dead-letter process | Delivery reliability | M |
| P2 | Containerized deployment and managed secret/config integration | Repeatable operations | M |
| P2 | Account recovery, verification resend, MFA, and security notifications | Product/security capability | L |
| P2 | Session/device management improvements | User control | M |
| P3 | Service decomposition only after measured load requires it | Long-term scale | L |

## Security Enhancements

- Replace opaque global token scans with a selector token plus a verifier token,
  or use a session ID in the refresh cookie and store a keyed HMAC of the secret.
- Rotate refresh tokens with a single compare-and-update operation. Revoke a
  token family when reuse is detected.
- Require CSRF tokens or strict origin verification for cookie-authenticated
  state changes. Keep `SameSite=Lax` where cross-site use is unnecessary.
- Use explicit JWT algorithm, issuer, audience, key ID, and key rotation.
- Validate minimum JWT secret strength and all URLs at startup.
- Add account lockout/risk controls based on IP, account, device, and velocity.
- Add MFA with TOTP or WebAuthn and recovery codes.
- Add verified-email resend with cooldowns and invalidation of prior tokens.
- Notify users about password changes, resets, and new-device logins.
- Add optional breached-password screening and stronger password length rules.
- Define account disable/delete behavior and ensure refresh blocks disabled users.
- Redact secrets and personal data from logs and error telemetry.
- Add Helmet, a strict frontend content-security policy, and dependency scanning.

## Scalability and Performance

- Add a TTL index on `Session.expiresAt` and indexes matching active-session
  queries, user session lists, and audit queries.
- Store directly queryable token selectors; never scan all users or sessions.
- Move rate-limit counters to Redis with environment-specific key prefixes.
- Add queue limits, priorities, per-recipient throttles, and backpressure.
- Keep API and worker autoscaling independent.
- Use connection pooling limits and timeout budgets for MongoDB, Redis, and SMTP.
- Paginate sessions and audit events.
- Archive or expire old audit records according to a retention policy.
- Cache only non-sensitive, measured hot paths; MongoDB remains authoritative.
- Run load tests around login, refresh, forgot-password, and worker throughput.

## Queue Reliability

- Define a discriminated union for job names and payloads.
- Validate job payloads at both enqueue and consume boundaries.
- Use deterministic job IDs for one logical email event.
- Record an email-delivery outbox event in the same MongoDB transaction as the
  state change, then publish it asynchronously.
- Make handlers idempotent and treat unknown job names as failures.
- Add jittered retry policies, permanent/transient error classification, and a
  dead-letter queue with an operator replay tool.
- Record delivery state without storing reset or verification links.
- Add graceful worker shutdown on both `SIGINT` and `SIGTERM`.

## Refactoring Opportunities

- Introduce typed `AuthenticatedRequest`, request DTOs, response DTOs, token
  claims, audit event enums, and BullMQ job types.
- Derive DTO types from runtime schemas or adopt a schema library with static
  inference to prevent Joi/runtime drift.
- Replace controller-level database orchestration with focused auth, session,
  password, and account services.
- Centralize cookie names, lifetimes, token policies, and security options.
- Create an application error hierarchy and a typed Express error handler.
- Replace Mongoose `Document`-extended domain interfaces with inferred schema
  types and explicit lean/read models where appropriate.
- Remove dead exports such as the unrouted welcome-email controller or expose
  them through a properly authorized use case.
- Standardize `.js`/`.ts` import strategy and the production build target.

## Monitoring and Observability

- Emit structured JSON logs with request IDs and secret redaction.
- Track request latency/error rate by route and status.
- Track authentication failures without logging passwords or tokens.
- Export MongoDB/Redis connection, queue depth, job age, retry, failure, and SMTP
  latency metrics.
- Add distributed tracing from HTTP request to queued job using correlation IDs.
- Alert on refresh-token reuse, password-reset spikes, queue backlog, dead-letter
  growth, dependency outages, and audit-write failures.
- Separate liveness from readiness and dependency diagnostics.
- Define SLOs for API availability, auth latency, and email delivery time.

## Infrastructure Upgrades

- Build API and worker containers from pinned lockfiles.
- Add CI stages for formatting, linting, type-checking, tests, dependency audit,
  secret scanning, and container scanning.
- Use managed MongoDB and Redis with TLS, authentication, private networking,
  backups, point-in-time recovery, and tested restore procedures.
- Store secrets in the deployment platform's secret manager.
- Apply least-privilege service identities and separate environments.
- Add a reverse proxy/load balancer with TLS, request limits, and explicit trusted
  proxy configuration.
- Define infrastructure as code and repeatable index migrations.

## Non-Breaking Feature Additions

- Verification-email resend endpoint with neutral responses and cooldowns.
- Current-session indicator and friendly device labels in session listings.
- Security event history sourced from audit records.
- Email notifications for sensitive account changes.
- Admin-only health/readiness diagnostics protected by network policy.
- User preference endpoints and notification opt-outs for non-security mail.
- API version/deprecation headers and generated OpenAPI documentation.

## Testing Strategy

- Unit-test token, cookie, validation, and password helpers.
- Integration-test every route with isolated MongoDB and Redis instances.
- Add race tests for refresh, reset, verification, logout-all, and password change.
- Add worker tests for retries, duplicate delivery, malformed jobs, and shutdown.
- Add security tests for CSRF, CORS, rate-limit bypass, token replay, object
  ownership, malformed JWTs, oversized input, and error leakage.
- Add contract tests to keep the Requestly/OpenAPI collection aligned with the API.
