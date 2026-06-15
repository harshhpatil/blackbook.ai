# Blackbook.ai Backend

Blackbook.ai currently contains a TypeScript authentication API built with
Express, MongoDB/Mongoose, Redis, BullMQ, JSON Web Tokens, and Nodemailer. The
implemented surface covers account registration, email verification, login,
access-token refresh, session management, password changes, and password
resets.

> Production status: not ready. See [BACKEND_AUDIT_REPORT.md](./BACKEND_AUDIT_REPORT.md)
> for confirmed correctness, security, concurrency, and deployment issues.

## Architecture

The backend is in `server/` and runs as two processes:

1. The API process accepts HTTP requests, reads and writes MongoDB, and
   publishes email jobs to Redis.
2. The worker process consumes BullMQ jobs from Redis and sends mail through
   Nodemailer.

MongoDB is the source of truth for users, refresh sessions, and audit events.
Redis is only used as the BullMQ transport. Access tokens are signed JWTs held
in cookies. Refresh tokens are opaque random values; their SHA-256 hashes are
stored in MongoDB session documents.

## Folder Structure

```text
.
├── README.md
├── BACKEND_AUDIT_REPORT.md
├── FUTURE_IMPLEMENTATIONS.md
├── package.json
├── pnpm-workspace.yaml
└── server/
    ├── blackbook.ai-backend/  # Requestly API collection
    ├── src/
    │   ├── config/            # MongoDB and Redis clients
    │   ├── controllers/       # Authentication request handlers
    │   ├── middlewares/       # Auth, validation, rate limit, role, errors
    │   ├── models/            # User, Session, and Audit schemas
    │   ├── routes/            # Express route declarations
    │   ├── services/          # Token, queue, and email operations
    │   ├── utils/             # Joi schemas and mail transport
    │   ├── workers/           # BullMQ email consumer and entry point
    │   ├── app.ts             # Express application
    │   └── index.ts           # API process entry point
    ├── package.json
    └── tsconfig.json
```

## Request Lifecycle

An API request follows this path:

```text
HTTP request
  -> CORS/body/cookie middleware
  -> route-specific rate limiter
  -> optional authentication middleware
  -> Joi body validation
  -> controller
  -> Mongoose and/or BullMQ operation
  -> JSON response
  -> global error middleware on failure
```

The API base path is `/api/v1/auth`. A liveness endpoint is available at
`GET /api/health`; it does not currently verify MongoDB, Redis, or SMTP health.

## Authentication Flow

### Registration and verification

`POST /register` validates the email and password, creates an unverified user,
stores a hashed 24-hour verification token, and enqueues a verification email.
`GET /verify-email?token=...` locates the token, marks the account verified,
clears the token, and queues a welcome email.

### Login and refresh

`POST /login` verifies the password and email status, creates a seven-day
session, and sets:

- `accessToken`: signed JWT, 15-minute lifetime
- `refreshToken`: opaque token, seven-day lifetime

`POST /refresh-token` rotates the refresh token and issues a new access token.
Protected routes use the access-token cookie. Authentication also compares the
JWT `tokenVersion` with the current user record.

### Password and session operations

- `POST /change-password` changes the authenticated user's password and revokes
  all sessions.
- `POST /forgot-password` stores a one-hour reset token and queues email.
- `POST /reset-password` consumes the reset token, changes the password, and
  revokes all sessions.
- `GET /sessions` lists the user's session records.
- `POST /logout`, `/logout-session/:sessionId`, and `/logout-all-sessions`
  revoke sessions at different scopes.

## Queue and Worker Architecture

The API publishes three BullMQ job names to the `emailQueue` queue:

- `send-verification-email`
- `send-welcome-email`
- `send-password-reset-email`

Jobs use three attempts with exponential backoff. The worker processes up to
five jobs concurrently. BullMQ delivery is at least once, so handlers must
eventually become idempotent; they are not idempotent in the current version.
Failed jobs are retained and completed jobs are deleted.

Run the worker independently from the API:

```bash
cd server
npm run worker
```

## Database Design

### User

Stores normalized unique email, bcrypt password hash, role, email verification
state, password-reset state, and `tokenVersion`.

### Session

Stores the user reference, refresh-token hash, expiration, revocation flag,
IP address, user agent, and timestamps.

### Audit

Stores a user reference, event name, IP address, user agent, arbitrary metadata,
and creation time. Audit-write failures are currently ignored.

The current schemas lack important TTL and query indexes. See the audit report
before using the data model at production scale.

## Environment Variables

Create `server/.env` locally. The committed `server/.env.template` is currently
empty and should be populated with placeholders only.

| Variable | Required by | Purpose |
| --- | --- | --- |
| `PORT` | API | HTTP listen port |
| `NODE_ENV` | API/worker | Enables production cookie settings when `production` |
| `MONGO_URI` | API | MongoDB connection URI |
| `REDIS_URL` | API/worker | Redis URI used by BullMQ |
| `JWT_SECRET` | API | HMAC key for access tokens |
| `CLIENT_URL` | API | Base URL used in verification/reset links |
| `EMAIL_USER` | Worker | SMTP/Gmail account |
| `EMAIL_PASS` | Worker | SMTP/Gmail password or app password |

Use a high-entropy `JWT_SECRET`, TLS-enabled managed service URLs, and a secret
manager in deployed environments. Never commit `.env` files or populated API
collections.

## Local Setup

Prerequisites:

- Node.js compatible with the selected TypeScript execution strategy
- pnpm 10 or npm
- MongoDB
- Redis
- SMTP credentials

```bash
cd server
npm install
npm run dev
```

In another terminal:

```bash
cd server
npm run worker
```

The current `npm run build` fails because `tsconfig.json` combines emitted
output with `allowImportingTsExtensions`. `npx tsc --noEmit` also reports a
missing Express `Request.user` declaration. These must be corrected before a
build-based deployment.

## Deployment

Do not deploy the current revision unchanged. After resolving the High findings
in the audit report:

1. Build immutable API and worker artifacts in CI.
2. Run the API and worker as separate services.
3. Configure MongoDB and Redis with authentication, TLS, backups, and network
   restrictions.
4. Configure an explicit frontend origin and credentialed CORS policy.
5. Set Express proxy trust to the exact deployment topology.
6. Use a shared rate-limit store.
7. Add readiness checks for MongoDB and Redis.
8. Handle `SIGTERM` by draining HTTP, BullMQ, Redis, and MongoDB connections.
9. Run migrations/index synchronization as a controlled deployment step.

## Development Guidelines

- Keep routes thin and put reusable business operations in typed services.
- Define DTOs once and derive runtime validation and TypeScript types together.
- Do not use `any` for requests, token payloads, jobs, errors, or audit metadata.
- Make token consumption and session rotation atomic.
- Give every queue job a typed payload, deterministic identity, and idempotency
  behavior.
- Add tests for both success paths and security failures before changing auth.
- Avoid logging credentials, tokens, reset links, or raw provider errors.
- Preserve unrelated uncommitted work when editing the repository.

## Known Limitations

- The project does not currently compile or pass a complete TypeScript check.
- There are no automated tests, lint script, CI workflow, container definition,
  or production process configuration.
- Session/token lookups scan many records and will degrade with growth.
- Rate limiting is process-local and IP-only.
- Password/session mutations and token consumption are not transactionally safe.
- Queue jobs may execute more than once and have no deduplication.
- The Requestly collection does not accurately model cookie-based auth.
- The root workspace references a `client` package that is not present here.

## Security Considerations

Before production, address all High findings in
[BACKEND_AUDIT_REPORT.md](./BACKEND_AUDIT_REPORT.md), especially:

- rotate and remove exposed Requestly credentials and tokens;
- stop returning refresh tokens in JSON;
- add CSRF protection and an explicit CORS policy;
- make refresh rotation and reset-token consumption atomic;
- fix error status propagation;
- replace global token/session scans with indexed selectors;
- use distributed, identity-aware rate limiting;
- validate environment configuration at startup;
- add security headers, redacted structured logging, and reliable audit storage.

The prioritized longer-term roadmap is documented in
[FUTURE_IMPLEMENTATIONS.md](./FUTURE_IMPLEMENTATIONS.md).
