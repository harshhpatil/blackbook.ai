# Frontend Auth Integration Guide

Audience: frontend developer implementing auth screens and API calls.

API base URL:

```text
http://localhost:3000
```

Auth route prefix:

```text
/api/v1/auth
```

## Core Rules

The backend uses cookie-based authentication.

- Do not store access tokens or refresh tokens in frontend state, localStorage, or sessionStorage.
- Always call auth endpoints with credentials enabled.
- Before any mutating auth request, fetch a CSRF token and send it in `x-csrf-token`.
- Protected requests rely on the `accessToken` HTTP-only cookie.
- Refresh relies on the `refreshToken` HTTP-only cookie.

Browser request setup:

```ts
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}
```

## CSRF Flow

Call this once before login/register and again whenever the app reloads or receives a CSRF failure.

```http
GET /api/v1/auth/csrf-token
```

Response:

```json
{
  "csrfToken": "hex-token"
}
```

The response also sets a readable `csrfToken` cookie. Store the JSON `csrfToken` in memory and send it on mutating auth requests:

```ts
let csrfToken = '';

export async function loadCsrfToken() {
  const res = await apiFetch('/api/v1/auth/csrf-token', {
    method: 'GET',
  });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

function csrfHeaders() {
  return { 'x-csrf-token': csrfToken };
}
```

If a mutating request returns `403` with `csrf token is required` or `invalid csrf token`, call `loadCsrfToken()` and retry once.

## Password Rules

Registration, password change, and password reset passwords must:

- be at least 8 characters;
- contain uppercase, lowercase, number, and one of `!@#$%^&*`;
- be 72 UTF-8 bytes or fewer.

Login password input also has a 72-character maximum.

## Routes

### Register

Creates an unverified account and sends a verification email.

```http
POST /api/v1/auth/register
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Body:

```json
{
  "email": "user@example.com",
  "password": "ChangeMe123!"
}
```

Success `201`:

```json
{
  "message": "User registered successfully. Please check your email to verify your account."
}
```

Common errors:

- `400`: validation failed.
- `409`: email is already registered.
- `403`: missing or invalid CSRF token.

Frontend behavior:

- Show a "check your email" state after success.
- Do not auto-login after registration.

### Verify Email

Consumes the token from the email link and enables login.

```http
GET /api/v1/auth/verify-email?token=<verificationToken>
```

Success `200`:

```json
{
  "message": "email verified successfully, you can now login..!!"
}
```

Common errors:

- `400`: invalid or expired verification token.
- `429`: too many verification attempts.

Frontend behavior:

- Build a verification page that reads `token` from the URL query string and calls this endpoint.
- On success, route the user to login.
- On invalid/expired token, show a recovery message. There is no resend endpoint yet.

### Login

Authenticates the user, creates a session, and sets HTTP-only `accessToken` and `refreshToken` cookies.

```http
POST /api/v1/auth/login
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Body:

```json
{
  "email": "user@example.com",
  "password": "ChangeMe123!"
}
```

Success `200`:

```json
{
  "message": "login successful..!!"
}
```

Common errors:

- `400`: missing/invalid body.
- `401`: invalid email or password.
- `403`: email is not verified, invalid CSRF token, or auth policy failure.
- `429`: too many login attempts.

Frontend behavior:

- On success, route to the authenticated app.
- Do not expect tokens in JSON. Cookies are set by the browser.
- Immediately call `GET /api/v1/auth/sessions` if you need to confirm auth state or populate session UI.

### Refresh Tokens

Rotates refresh token and issues a new access token cookie.

```http
POST /api/v1/auth/refresh-token
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Body: none.

Success `200`:

```json
{
  "message": "tokens refreshed successfully"
}
```

Common errors:

- `401`: missing, expired, revoked, or already rotated refresh token.
- `403`: invalid CSRF token.
- `429`: too many refresh attempts.

Frontend behavior:

- When a protected API call returns `403` or `401`, call refresh once, then retry the original request once.
- If refresh fails, clear client auth UI state and route to login.

Example wrapper:

```ts
async function authedFetch(path: string, options: RequestInit = {}) {
  let res = await apiFetch(path, options);

  if (res.status !== 401 && res.status !== 403) {
    return res;
  }

  const refresh = await apiFetch('/api/v1/auth/refresh-token', {
    method: 'POST',
    headers: csrfHeaders(),
  });

  if (!refresh.ok) {
    return res;
  }

  return apiFetch(path, options);
}
```

### Get Active Sessions

Lists active sessions for the logged-in user.

```http
GET /api/v1/auth/sessions
```

Auth: requires valid `accessToken` cookie.

Success `200`:

```json
{
  "sessions": [
    {
      "_id": "sessionId",
      "user": "userId",
      "expiresAt": "2026-06-27T12:00:00.000Z",
      "revoked": false,
      "userAgent": "browser user agent",
      "ip": "::1",
      "createdAt": "2026-06-20T12:00:00.000Z",
      "updatedAt": "2026-06-20T12:00:00.000Z"
    }
  ]
}
```

Common errors:

- `401`: missing token.
- `403`: invalid, expired, revoked, or session-mismatched token.

Frontend behavior:

- Use this endpoint as a simple "am I logged in?" check.
- Show device/session rows using `userAgent`, `ip`, and `createdAt`.
- Hide or label the current session client-side if you track the latest login locally. The backend does not currently mark `isCurrent`.

### Logout Current Session

Revokes the current refresh session and clears auth cookies.

```http
POST /api/v1/auth/logout
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Body: none.

Success `200`:

```json
{
  "message": "logged out successfully"
}
```

Frontend behavior:

- On success, clear client auth state and route to login.
- If it returns unauthorized, still clear client auth state.

### Logout One Session

Revokes one session by ID. The session must belong to the authenticated user.

```http
POST /api/v1/auth/logout-session/:sessionId
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Success `200`:

```json
{
  "message": "session logged out successfully"
}
```

Common errors:

- `404`: session not found or already revoked.
- `401`/`403`: missing or invalid auth/CSRF.

Frontend behavior:

- Use this from a session management screen.
- After success, refetch `/sessions`.

### Logout All Sessions

Revokes every active session for the authenticated user and increments token version.

```http
POST /api/v1/auth/logout-all-sessions
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Success `200`:

```json
{
  "message": "all sessions logged out successfully"
}
```

Frontend behavior:

- Treat this as a full logout everywhere.
- Clear local auth state and route to login.

### Change Password

Changes password for an authenticated user and revokes all active sessions.

```http
POST /api/v1/auth/change-password
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Body:

```json
{
  "oldPassword": "ChangeMe123!",
  "newPassword": "ChangeMe124!"
}
```

Success `200`:

```json
{
  "message": "password changed successfully"
}
```

Common errors:

- `400`: invalid body or same old/new password.
- `401`: current password incorrect or missing auth.
- `403`: invalid access token/session or CSRF token.

Frontend behavior:

- On success, show confirmation and route to login because sessions are revoked and cookies are cleared.

### Forgot Password

Starts password reset. Response is neutral to avoid account enumeration.

```http
POST /api/v1/auth/forgot-password
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Body:

```json
{
  "email": "user@example.com"
}
```

Success `200`:

```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

Frontend behavior:

- Always show the same success message for `200`.
- Do not reveal whether an account exists.

### Reset Password

Consumes the reset token, changes password, revokes sessions, and clears cookies.

```http
POST /api/v1/auth/reset-password
```

Headers:

```text
x-csrf-token: <csrfToken>
```

Body:

```json
{
  "token": "reset-token-from-url",
  "newPassword": "ChangeMe124!"
}
```

The backend also accepts `?token=<resetToken>` if the body token is normalized before validation, but the frontend should send the token in the JSON body.

Success `200`:

```json
{
  "message": "Password reset successfully"
}
```

Common errors:

- `400`: invalid/expired reset token or invalid password.
- `403`: invalid CSRF token.

Frontend behavior:

- Build a reset page that reads `token` from the URL query string.
- Submit `{ token, newPassword }`.
- On success, route to login.

## Health Routes

### Liveness

```http
GET /api/health
```

Use only to confirm the API process is running.

### Readiness

```http
GET /api/ready
```

Success `200` when MongoDB and Redis are ready. Returns `503` if either dependency is unavailable.

Frontend should not call readiness during normal app usage; it is for deployment and diagnostics.

## Error Shape

Most errors return:

```json
{
  "message": "error message"
}
```

Validation errors return:

```json
{
  "message": "Validation failed",
  "errors": ["detail message"]
}
```

Handle by status code first, then show the backend `message` where appropriate.

## Recommended Frontend Pages

Minimum auth screens:

- Register
- Check email / verification pending
- Verify email callback
- Login
- Forgot password
- Reset password
- Account security / change password
- Session management

Minimum app-level auth logic:

- Load CSRF token on app startup.
- Use `credentials: 'include'` for all backend calls.
- Use `/sessions` to check logged-in state.
- Use refresh-once retry for protected API calls.
- Redirect to login when refresh fails.
- Clear local auth UI state after logout, logout-all, password change, or reset password.

## Local Development Checklist

Backend `.env` must include:

```text
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
CROSS_SITE_COOKIES=false
```

Frontend `.env` should include:

```text
VITE_API_URL=http://localhost:3000
```

For local Vite frontend on `localhost:5173`, cookies should work with `credentials: 'include'`.

