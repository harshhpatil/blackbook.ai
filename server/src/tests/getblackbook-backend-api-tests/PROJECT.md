# Getblackbook Backend API Collection (Requestly)

Manual testing collection for the Blackbook AI backend API.

## Base Configuration & Environments
- **Environment**: `Local`
- **Base URL**: `http://localhost:3000`
- **API Prefix**: `/api/v1`

## API Modules & Collections

### 1. Authentication (`/api/v1/auth`)
- `GET /csrf-token`: Fetches a fresh double-submit CSRF cookie.
- `POST /register`: Registers a new user account.
- `POST /login`: Authenticates with email & password, sets `accessToken` & `refreshToken` HTTP-only cookies.
- `POST /send-otp` & `POST /verify-otp`: Mobile number SMS verification.

### 2. User Profile (`/api/v1/users`)
- `GET /me`: Retrieve logged-in user profile.
- `PATCH /me`: Update profile fields (`name`, `company`, `bio`, `timezone`).
- `POST /me/avatar`: Multipart form-data image upload for avatar stored in R2.
- `GET /me/export-data`: Export GDPR data archive.
- `DELETE /me`: Permanently close account and delete assets.

### 3. Notifications (`/api/v1/notifications`)
- `GET /`: Retrieve paginated notifications.
- `GET /stream`: Connect to Server-Sent Events (SSE) live push stream.
- `PATCH /:notificationId/read`: Mark single notification as read.
- `POST /mark-all-read`: Mark all notifications as read.

### 4. Credits & Billing (`/api/v1/credits`)
- `GET /balance`: View current credit balance & transaction ledger.

### 5. Admin Backoffice (`/api/v1/admin`)
- `GET /stats`: Retrieve system overview metrics.
- `GET /users`: Paginated user listing.
- `POST /users/:userId/credits`: Manually grant credits to a target user.

### 6. Projects & Workspaces (`/api/v1/projects`)
- `GET /`: Fetch user projects.
- `POST /`: Create project workspace.
- `GET /:projectId`: Retrieve aggregated project details.
- `DELETE /:projectId`: Delete project workspace.

### 7. Document Engine (`/api/v1/template-engine`)
- `POST /template`: Upload DOCX template.
- `POST /raw`: Upload source PDF/DOCX/TXT data.
- `POST /generate`: Enqueue AI document generation job.
- `POST /train/analyze`: Train AI on a sample document.
