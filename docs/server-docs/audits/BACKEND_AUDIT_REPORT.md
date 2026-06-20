# Backend Engineering and Security Audit

Audit date: 2026-06-16

Scope: all non-generated backend source, configuration, package metadata, local
environment templates, and the Requestly API collection. `node_modules` and
build artifacts were excluded. The review traced every registered route through
middleware, controllers, MongoDB operations, Redis/BullMQ publication, worker
execution, and response/error handling.

## Executive Summary

The backend is a useful development-stage authentication implementation, but it
is not ready for production. No direct database injection or server-side request
forgery path was found in the current route set. Authorization ownership checks
exist for per-session logout, password hashes are excluded by default, and raw
verification/reset/refresh tokens are hashed at rest.

The largest risks are exposed local credentials, missing CSRF controls,
refresh-token exposure and races, global token scans, broken error mapping,
non-atomic password/session updates, process-local rate limits, and a build that
does not compile. Queue delivery is also non-idempotent and operational controls
are largely absent.

Finding count:

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 11 |
| Medium | 17 |
| Low | 8 |

## Verification Performed

- Reviewed every file under `server/src`.
- Reviewed root/server package metadata, TypeScript configuration, ignore rules,
  environment key usage, and Requestly request definitions.
- Ran `npm run build`: failed with TypeScript `TS5096`.
- Ran `npx tsc --noEmit`: failed because Express `Request.user` is undeclared.
- Confirmed no automated test suite or lint script exists in the backend.
- `pnpm` commands could not be run because pnpm is not installed in the audit
  environment; npm used the installed dependency tree instead.

## Request Flow Findings

### Registration

Validation and normalization are present. The user is committed before the
verification job is published, so Redis failure can leave a permanently
unverified account. There is no resend path after token expiry. The pre-check
for an existing email is race-prone, although MongoDB's unique index remains the
final defense.

### Verification

The controller loads every unexpired verification-token user and hashes the
provided token against each record. Verification and token clearing are not an
atomic consume operation, so concurrent requests can enqueue duplicate welcome
emails.

### Login

Password and verified-email checks are correct. A MongoDB session is created and
cookies are set, but the refresh token is also returned in JSON, defeating the
intended HTTP-only boundary.

### Refresh

The controller scans every active session and compares hashes sequentially.
Refresh rotation is read/modify/save rather than compare-and-swap, permitting
concurrent use of one token. There is no reuse detection or token-family
revocation.

### Password changes and resets

Password changes correctly verify the old password. Reset responses avoid
account enumeration. Session revocation, token consumption, password hashing,
and user updates are separate operations without a transaction. Concurrent
reset requests can both consume one token and set different passwords.

### Session management

Ownership is checked for `logout-session/:sessionId`. Normal logout only searches
the first 100 active sessions globally and does not immediately invalidate the
access JWT. Session listing includes expired and revoked sessions despite being
described as active.

### Queue processing

Queue and worker names match. Retries are configured, but jobs are not
deduplicated or idempotent, payloads are untyped/unvalidated, unknown jobs are
reported as successful, and failed jobs have no retention/dead-letter policy.

## Detailed Findings

### H-01: Sensitive credentials and tokens in the Requestly project

- Severity: High
- Affected files: `server/blackbook.ai-backend/apis/auth/**/__auth.json`,
  `server/blackbook.ai-backend/apis/auth/**/__body.json`
- Root cause: populated request fixtures contain real-looking personal email
  addresses, plaintext passwords, password-reset tokens, refresh tokens, signed
  JWTs, and a fixed user/session identifier. The directory is untracked but is
  not excluded by `.gitignore`.
- Impact: accidental commit, screen sharing, backups, or artifact upload can
  expose account credentials and reusable authentication material.
- Recommended fix: rotate every exposed credential/token, replace values with
  placeholders/variables, add secret scanning, and ignore local populated
  Requestly state or commit only sanitized fixtures.

### H-02: Cookie authentication has no CSRF defense

- Severity: High
- Affected files: `server/src/app.ts:14`,
  `server/src/controllers/auth/auth.helpers.ts:8`,
  `server/src/routes/auth.routes.ts:49`
- Root cause: production cookies use `SameSite=None`; mutating routes accept
  cookies without CSRF tokens or `Origin`/`Referer` validation. URL-encoded
  bodies are enabled, broadening form-based attack options.
- Impact: a malicious site can induce authenticated state changes, including
  password/session operations, when browser and deployment conditions permit.
- Recommended fix: use `SameSite=Lax` or `Strict` when possible. Otherwise add a
  robust CSRF token pattern plus strict origin checks to every state-changing
  cookie-authenticated route.

### H-03: Refresh token is exposed to JavaScript in the login response

- Severity: High
- Affected file: `server/src/controllers/auth/login.controller.ts:88`
- Root cause: the refresh token is returned in JSON after also being placed in
  an HTTP-only cookie.
- Impact: XSS, browser extensions, frontend logging, telemetry, and response
  inspection can steal a seven-day credential.
- Recommended fix: return only non-sensitive session/user metadata. Keep the
  refresh token exclusively in the HTTP-only cookie.

### H-04: Refresh rotation is non-atomic and lacks replay detection

- Severity: High
- Affected file: `server/src/controllers/auth/session.controller.ts:23`
- Root cause: lookup, token verification, replacement, and save are separate
  operations. Two requests can match the old token before either save completes.
- Impact: concurrent replay can issue multiple access/refresh pairs; the final
  database write invalidates one client unpredictably and stolen-token reuse is
  not detected.
- Recommended fix: use a directly addressable session/token selector and an
  atomic conditional update on the old hash/version. Track token families and
  revoke the family on reuse.

```ts
const session = await Session.findOneAndUpdate(
  { _id: sessionId, tokenHash: oldHash, revoked: false, expiresAt: { $gt: now } },
  { $set: { tokenHash: newHash, expiresAt: nextExpiry }, $inc: { version: 1 } },
  { new: true }
);
```

### H-05: Token and session verification performs global collection scans

- Severity: High
- Affected files: `server/src/controllers/auth/account.controller.ts:116`,
  `server/src/controllers/auth/password.controller.ts:152`,
  `server/src/controllers/auth/session.controller.ts:25`
- Root cause: SHA-256 token hashes are deterministic and queryable, but the code
  loads all active candidates and compares them in application code.
- Impact: request latency and database/network load grow linearly with users and
  sessions. Public endpoints can be abused for CPU and database exhaustion.
- Recommended fix: compute the presented token's hash and query it directly with
  its expiry/revocation predicate. Add matching indexes.

### H-06: Password reset tokens can be consumed concurrently

- Severity: High
- Affected file: `server/src/controllers/auth/password.controller.ts:151`
- Root cause: token validation and clearing occur in separate reads/writes.
- Impact: two requests using one reset token can both succeed; the last password
  write wins, enabling confusing or adversarial account takeover races.
- Recommended fix: atomically claim/clear the matching unexpired token before
  changing the password, preferably in a MongoDB transaction that also revokes
  sessions and increments `tokenVersion`.

### H-07: Password/session security updates are not transactional

- Severity: High
- Affected file: `server/src/controllers/auth/password.controller.ts:47`
- Root cause: session revocation and user password/token-version saves are
  separate operations and occur in different orders across flows.
- Impact: partial failures can revoke sessions without changing the password or
  change account state without completing all intended revocations.
- Recommended fix: use a MongoDB transaction for password mutation, token
  consumption, token-version increment, and session revocation.

### H-08: Error status mapping is broken

- Severity: High
- Affected files: `server/src/controllers/auth/auth.helpers.ts:42`,
  `server/src/middlewares/errorHandeler.middleware.ts:11`
- Root cause: `AuthError` stores `statusCode`; the error handler reads `status`.
- Impact: expected 400/401/403/409 failures become HTTP 500, breaking clients,
  monitoring, retry behavior, and security controls that depend on status.
- Recommended fix: standardize one typed property and recognize known database
  validation/duplicate-key errors without exposing internals.

### H-09: CORS configuration is incompatible with secure cross-origin cookies

- Severity: High
- Affected file: `server/src/app.ts:14`
- Root cause: default `cors()` allows any origin but does not allow credentials.
- Impact: a separate browser frontend cannot reliably send or receive auth
  cookies. Ad hoc production changes may create an unsafe wildcard/credentials
  configuration.
- Recommended fix: configure an allowlist from validated environment settings,
  set `credentials: true`, and reject unknown origins.

### H-10: Registration can create inaccessible orphan accounts

- Severity: High
- Affected file: `server/src/controllers/auth/account.controller.ts:37`
- Root cause: user creation commits before `CLIENT_URL` validation and Redis job
  publication. There is no resend-verification endpoint.
- Impact: configuration or queue failure returns an error after reserving the
  email; retries receive "already registered," and the token eventually expires.
- Recommended fix: validate configuration before writes and use a transactional
  outbox. Add a neutral, rate-limited resend flow that rotates the token.

### H-11: The backend cannot be built or fully type-checked

- Severity: High
- Affected files: `server/tsconfig.json:11`,
  `server/src/middlewares/auth.middleware.ts:38`,
  `server/src/middlewares/roleGuard.middleware.ts:6`
- Root cause: `allowImportingTsExtensions` is incompatible with emitted output
  without a rewrite/no-emit option, and no Express module augmentation declares
  `Request.user`.
- Impact: CI/build deployment fails; developers are encouraged to bypass type
  checking, hiding further runtime defects.
- Recommended fix: choose one consistent NodeNext build strategy, add typed
  Express augmentation, and require `tsc` in CI.

### M-01: Normal logout may reject valid sessions after the first 100

- Severity: Medium
- Affected file: `server/src/controllers/auth/session.controller.ts:105`
- Root cause: logout scans a global, unsorted `.limit(100)` result.
- Impact: valid users may be unable to log out; behavior changes with unrelated
  users' sessions.
- Recommended fix: address the session directly using a selector embedded in the
  refresh token/cookie and verify ownership.

### M-02: Logout does not immediately invalidate the access token

- Severity: Medium
- Affected file: `server/src/controllers/auth/session.controller.ts:123`
- Root cause: logout and per-session logout revoke refresh state only;
  authentication does not bind the JWT to a session or check revocation.
- Impact: a copied access token remains usable for up to 15 minutes after logout.
- Recommended fix: include a session ID in JWT claims and check revocation for
  high-risk operations, or clearly document short-lived access-token behavior.

### M-03: Rate limiting is process-local, IP-only, and proxy-undefined

- Severity: Medium
- Affected files: `server/src/middlewares/rateLimiter.middleware.ts:4`,
  `server/src/app.ts:11`
- Root cause: the default in-memory store is used and Express proxy trust is not
  configured.
- Impact: limits reset per instance/restart, can be bypassed across replicas,
  and may collapse all users behind a proxy into one address.
- Recommended fix: use a Redis store, exact trusted-proxy configuration, and
  route-specific keys combining normalized account and IP where appropriate.

### M-04: Verification is not an atomic one-time operation

- Severity: Medium
- Affected file: `server/src/controllers/auth/account.controller.ts:143`
- Root cause: matching, state update, and welcome-job publication are separate.
- Impact: concurrent requests can report success and enqueue duplicate welcome
  emails.
- Recommended fix: atomically update the matching unverified user and enqueue an
  idempotent outbox event.

### M-05: Email jobs are non-idempotent and may duplicate side effects

- Severity: Medium
- Affected files: `server/src/services/emailQueue.service.ts:14`,
  `server/src/workers/email.worker.ts:10`
- Root cause: BullMQ retries provide at-least-once delivery, but no deterministic
  job ID, delivery key, or sent-state check exists.
- Impact: users can receive duplicate verification, welcome, or reset emails.
- Recommended fix: assign a logical event ID/job ID and make consumer delivery
  idempotent.

### M-06: Unknown or malformed jobs can complete successfully

- Severity: Medium
- Affected file: `server/src/workers/email.worker.ts:12`
- Root cause: job names/data use untyped `Job`; unknown names only log a warning,
  and payload fields are not validated.
- Impact: producer mistakes or queue tampering silently drop email workflows.
- Recommended fix: use a discriminated job union, validate payloads, and throw on
  unknown names so the job reaches failure handling.

### M-07: Missing session TTL and query indexes

- Severity: Medium
- Affected file: `server/src/models/Session.model.ts:16`
- Root cause: no TTL index on `expiresAt` and no compound index for user/revoked
  session queries.
- Impact: expired sessions accumulate and queries degrade over time.
- Recommended fix: add controlled index migrations, including an `expiresAt`
  TTL index and indexes based on the redesigned selector/session queries.

### M-08: Queue failure handling can grow Redis indefinitely

- Severity: Medium
- Affected file: `server/src/services/emailQueue.service.ts:20`
- Root cause: failed jobs are retained without age/count limits or a dead-letter
  workflow.
- Impact: repeated SMTP failures consume Redis memory and require manual repair.
- Recommended fix: set bounded failure retention and move terminal failures to a
  monitored dead-letter process.

### M-09: Redis/queue availability is coupled to API module loading

- Severity: Medium
- Affected files: `server/src/config/redisConnection.ts:3`,
  `server/src/services/emailQueue.service.ts:5`
- Root cause: Redis is instantiated at import time and missing configuration
  calls `process.exit`. `maxRetriesPerRequest: null` can leave API requests
  waiting during an outage.
- Impact: tests and unrelated routes require Redis configuration; queue outages
  can reduce API availability or hang account operations.
- Recommended fix: validate config in the entry point, inject clients, set
  explicit operation timeouts, and use an outbox to decouple API commits.

### M-10: Environment configuration is incomplete and weakly validated

- Severity: Medium
- Affected files: `server/.env.template`,
  `server/src/index.ts:5`, `server/src/config/*.ts`,
  `server/src/utils/email.ts:4`
- Root cause: the template is empty and checks only test presence, not URL,
  port, secret strength, or cross-variable consistency.
- Impact: deployment errors surface late, links/cookies may target the wrong
  origin, and weak secrets can be accepted.
- Recommended fix: define a typed startup schema and fail once with redacted,
  actionable validation errors.

### M-11: JWT verification policy is underspecified

- Severity: Medium
- Affected files: `server/src/services/token.service.ts:22`,
  `server/src/middlewares/auth.middleware.ts:30`
- Root cause: algorithm, issuer, audience, subject, and key rotation policy are
  not explicit.
- Impact: tokens are harder to scope, rotate, and safely share across services;
  configuration mistakes have a larger blast radius.
- Recommended fix: pin `HS256` or move to asymmetric keys, validate
  issuer/audience, use `sub`, and support key IDs/rotation.

### M-12: Forgot-password writes an active token before queue success

- Severity: Medium
- Affected file: `server/src/controllers/auth/password.controller.ts:106`
- Root cause: reset state is saved before email job publication.
- Impact: queue failure leaves an active unseen token; concurrent requests cause
  earlier emailed links to become invalid unpredictably.
- Recommended fix: use a transactional outbox and define token rotation/cooldown
  semantics.

### M-13: Sensitive personal data and provider errors are logged

- Severity: Medium
- Affected files: `server/src/services/emailQueue.service.ts:28`,
  `server/src/workers/email.worker.ts:17`,
  `server/src/services/email.service.ts:23`,
  `server/src/middlewares/errorHandeler.middleware.ts:10`
- Root cause: email addresses, raw mail errors, and full stack traces are logged
  without structured redaction or environment controls.
- Impact: logs can expose personal data, provider details, paths, and potentially
  credentials embedded in upstream errors.
- Recommended fix: use structured logging with redaction, correlation IDs, and
  production-safe error serialization.

### M-14: Audit failures are silently discarded

- Severity: Medium
- Affected file: `server/src/controllers/auth/auth.helpers.ts:24`
- Root cause: the catch block is empty.
- Impact: security events can disappear without alerting, weakening incident
  response and compliance evidence.
- Recommended fix: emit a redacted operational error/metric and define whether
  high-risk actions fail closed, use an outbox, or accept degraded auditing.

### M-15: Worker shutdown and API shutdown are incomplete

- Severity: Medium
- Affected files: `server/src/workers/run-worker.ts:7`,
  `server/src/index.ts:12`
- Root cause: the worker handles only `SIGINT` and does not close Redis; the API
  has no signal handling for HTTP, MongoDB, or Redis.
- Impact: deployments can terminate active requests/jobs and leave duplicate
  work or delayed socket cleanup.
- Recommended fix: handle `SIGINT` and `SIGTERM`, stop accepting work, drain with
  a timeout, and close all clients.

### M-16: Password policy has no maximum length and ignores bcrypt's input limit

- Severity: Medium
- Affected file: `server/src/utils/validation.ts:10`
- Root cause: registration/change/reset require complexity but set no maximum or
  byte-length rule.
- Impact: passwords that differ after bcrypt's effective input boundary may
  authenticate identically; oversized login inputs also waste resources.
- Recommended fix: use a long passphrase-friendly policy with an explicit byte
  limit compatible with the hash function, and reject rather than silently
  truncate.

### M-17: Requestly auth contracts do not match runtime cookie auth

- Severity: Medium
- Affected files: `server/blackbook.ai-backend/apis/auth/**`
- Root cause: protected requests are configured with bearer tokens while the API
  reads only cookies; the collection also omits `/sessions` and `/verify-email`.
- Impact: manual tests give misleading results and can mask regressions.
- Recommended fix: use collection variables/cookie handling, sanitize fixtures,
  and add every registered endpoint with assertions.

### L-01: Session listing contradicts its "active sessions" contract

- Severity: Low
- Affected file: `server/src/controllers/auth/session.controller.ts:153`
- Root cause: the query filters only by user.
- Impact: clients receive revoked and expired records without a clear status
  contract.
- Recommended fix: filter active sessions or rename the response and expose an
  explicit computed status with pagination.

### L-02: Constant-time comparison is not used for token hashes

- Severity: Low
- Affected file: `server/src/services/token.service.ts:44`
- Root cause: digest strings are compared with `===`.
- Impact: timing differences are unlikely to be practically exploitable over
  this network path but are avoidable.
- Recommended fix: compare equal-length buffers with `crypto.timingSafeEqual`.

### L-03: Validation middleware does not apply normalized values

- Severity: Low
- Affected file: `server/src/middlewares/validate.middleware.ts:8`
- Root cause: Joi's validated/coerced value is discarded.
- Impact: future schema defaults, trimming, conversions, or sanitizers will not
  reach controllers, increasing runtime/type drift.
- Recommended fix: assign the validated value to a typed request DTO.

### L-04: Type safety is weakened throughout auth and queue code

- Severity: Low
- Affected files: `server/src/services/token.service.ts:13`,
  `server/src/controllers/auth/*.ts`,
  `server/src/workers/email.worker.ts:12`,
  `server/src/models/Audit.model.ts:9`
- Root cause: `any`, double assertions, generic strings, and untyped request
  bodies/jobs bypass declared interfaces. `ITokenPayload` is unused.
- Impact: refactors can compile locally only after casts while runtime contracts
  silently diverge.
- Recommended fix: introduce inferred DTOs, typed authenticated requests, audit
  event unions, token claims, and BullMQ job maps.

### L-05: Dead/unrouted code and unused authorization middleware exist

- Severity: Low
- Affected files: `server/src/controllers/auth/account.controller.ts:75`,
  `server/src/controllers/auth.controller.ts:6`,
  `server/src/middlewares/roleGuard.middleware.ts:4`
- Root cause: `welcomeEmail` is exported but has no route; role guard is unused.
- Impact: unclear attack surface and maintenance burden; future developers may
  expose behavior without reviewing authorization.
- Recommended fix: remove dead code or add a documented, authenticated use case
  with tests.

### L-06: Health endpoint is only a liveness response

- Severity: Low
- Affected file: `server/src/app.ts:20`
- Root cause: it always returns success after the process starts.
- Impact: orchestrators may route traffic while MongoDB or Redis is unavailable.
- Recommended fix: keep a cheap liveness endpoint and add a readiness endpoint
  with bounded dependency checks.

### L-07: Error middleware and startup handling are weakly typed

- Severity: Low
- Affected files: `server/src/middlewares/errorHandeler.middleware.ts:5`,
  `server/src/index.ts:12`
- Root cause: errors are `any`, `next` is unused, and top-level startup has no
  rejection handler.
- Impact: unexpected error shapes can cause secondary errors or unhandled
  rejection behavior.
- Recommended fix: accept `unknown`, narrow it, return after sending, and handle
  startup failure in one entry-point boundary.

### L-08: Packaging and repository metadata are inconsistent

- Severity: Low
- Affected files: `server/package.json:6`, `pnpm-workspace.yaml:2`,
  `server/package-lock.json`, `pnpm-lock.yaml`
- Root cause: `main` does not describe emitted output, `start` executes a `.ts`
  source file directly, two lockfile ecosystems exist, and the workspace names a
  missing `client`.
- Impact: local/CI/deployment behavior depends on tool and Node version.
- Recommended fix: standardize one package manager, one lockfile, one build/run
  strategy, and an accurate workspace manifest.

## Architecture and Data Consistency Risks

MongoDB is the authoritative account/session store, while Redis carries
side-effect jobs. There is no transaction or outbox linking these systems.
Consequently, MongoDB commits can succeed while queue publication fails, and
retries can publish duplicate jobs. Redis loss does not corrupt password/session
state, but it can lose expected email delivery. MongoDB partial writes can leave
password and session state inconsistent because multi-document transactions are
not used.

The recommended target is:

1. Commit account/security state plus an outbox event in one MongoDB transaction.
2. Publish the outbox event to BullMQ with a deterministic ID.
3. Mark publication/delivery state idempotently.
4. Reconcile stuck outbox events and dead-letter jobs with metrics and alerts.

## Test Gaps

No automated tests were found. Minimum production gate:

- Route integration tests for every status and validation branch.
- Ownership/access-control tests for every session endpoint.
- CSRF/CORS and cookie attribute tests.
- Concurrent refresh, reset, verify, logout-all, and password-change tests.
- Queue retry, duplicate, malformed payload, Redis outage, and SMTP outage tests.
- Index/query tests with realistic session/user volumes.
- Startup/configuration and graceful-shutdown tests.

## Production Exit Criteria

Before deployment:

1. Resolve H-01 through H-11.
2. Make `npm run build`, type-checking, linting, tests, and secret scanning pass
   in CI.
3. Rotate all exposed credentials and sanitize/ignore local API fixtures.
4. Add atomic session/token operations and required indexes.
5. Deploy explicit CORS, CSRF, proxy, cookie, and distributed rate-limit policy.
6. Add idempotent outbox-backed email delivery.
7. Add readiness, structured logs, metrics, alerts, backups, and restore tests.
