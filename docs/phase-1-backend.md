# Phase 1 backend: foundation, authentication, and RBAC

## Architecture

The API is an Express 5 modular monolith. Feature code lives under `server/src/modules`, shared
middleware under `server/src/middleware`, and infrastructure adapters under `server/src/lib`.
PostgreSQL is the source of truth and Prisma is the only database access layer.

Authentication uses a short-lived JWT access token returned in the response and an opaque rotating
refresh token stored in an `HttpOnly`, `SameSite=Strict` cookie by default. Only a SHA-256 hash of each refresh
token is stored. Protected requests also verify that the backing database session is active, so
logout, password reset, and password change revoke access immediately.

Authorization is permission-based RBAC. The seeded `admin`, `advisor`, and `staff` roles are mappings
of permissions, not hard-coded route behavior. Advisor ownership checks use the reusable
`requireAdvisorOwnership` middleware; each later domain module must resolve the owner from the
database rather than trusting an advisor ID supplied by the client.

## Local setup

Requirements: Node.js 24 or newer, Docker Desktop (or another PostgreSQL 17-compatible server), and
npm.

1. Copy `.env.example` to `.env` if `.env` is absent. Replace the JWT secret and development database
   password for any shared environment.
2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

3. Apply the checked-in migration and seed roles/users:

   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```

4. Start the API:

   ```bash
   npm run dev:api
   ```

5. Verify health at `http://127.0.0.1:4000/api/v1/health`.

For schema development, use `npm run db:migrate -- --name <migration_name>`. Production and CI must
use `npm run db:migrate:deploy` and must not use `migrate dev`.

## Seed identities

The seed password is read from `SEED_DEFAULT_PASSWORD`. The development example uses
`cibilon@123`; it must be changed outside local development.

| Role | Email | Identity code |
| --- | --- | --- |
| Administrator | `admin@cibilon.in` | — |
| Advisor | `advisor@cibilon.in` | `DSA-DEMO-001` |
| Operations staff | `staff@cibilon.in` | `EMP-DEMO-001` |

The seed is idempotent and does not overwrite an existing user's password.

## APIs added

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | Public | API and database health |
| POST | `/api/v1/auth/login` | Public, throttled | Login by email or mobile |
| POST | `/api/v1/auth/refresh` | Refresh cookie | Rotate session and access token |
| POST | `/api/v1/auth/logout` | Refresh cookie | Revoke session and clear cookie |
| POST | `/api/v1/auth/forgot-password` | Public | Create a 30-minute reset token |
| POST | `/api/v1/auth/reset-password` | Reset token | Set password and revoke sessions |
| POST | `/api/v1/auth/change-password` | Bearer token | Change password and revoke sessions |
| POST | `/api/v1/auth/users` | `users:create` | Internal user creation (admin seed role) |
| GET | `/api/v1/me` | Bearer token | Current identity, roles, and permissions |
| GET | `/api/v1/audit-logs` | `audit:read` | Search/filter/sort/page audit events |

All successful JSON responses use `{ "data": ... }`. List responses also contain `pagination`.
Errors use `{ "error": { "code", "message", "requestId", "details?" } }`.

In development only, forgot-password responses include `devResetToken` because outbound email is an
explicit future integration. Production never returns the token.

## Manual verification

The examples below use PowerShell and preserve the refresh cookie in a web session.

```powershell
$loginBody = @{
  identifier = 'admin@cibilon.in'
  password = 'cibilon@123'
  remember = $true
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:4000/api/v1/auth/login' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $loginBody `
  -SessionVariable apiSession

$accessToken = $login.data.accessToken
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:4000/api/v1/me' `
  -Headers @{ Authorization = "Bearer $accessToken" }

Invoke-RestMethod `
  -Uri 'http://127.0.0.1:4000/api/v1/auth/refresh' `
  -Method Post `
  -WebSession $apiSession
```

RBAC checks:

- Call `GET /api/v1/me` without a bearer token; expect `401`.
- Login as the advisor and call `POST /api/v1/auth/users`; expect `403`.
- Login as the admin and call the same route with a strong password and valid body; expect `201`.
- Login as admin or staff and call `/api/v1/audit-logs?page=1&pageSize=25`; expect `200`.
- Call logout with the saved web session, then retry the previous bearer token; expect `401` because
  the backing session is revoked.

Build checks:

```bash
npm run typecheck
npm run build:api
npm run build
npm audit --omit=dev
```

## Security notes and deferred integration points

- Request logs redact authorization, cookie, password, and token fields.
- Passwords use bcrypt with a configurable cost (12 by default).
- Reset and refresh tokens are single-use and stored only as hashes.
- Password reset/change revokes every active session for the user.
- Audit logs capture actor, request ID, IP, user agent, entity, action, and metadata. A database
  trigger rejects updates and deletes.
- CORS accepts only `FRONTEND_ORIGIN`; credentials are enabled for the refresh cookie.
- `COOKIE_SECURE=true`, a strong JWT secret, TLS, and a non-default database password are mandatory
  in production.
- Email delivery is deliberately a future adapter. The service currently creates secure reset
  tokens and returns one only in development.
- Phase 1 does not connect the frontend; that controlled integration is scheduled for Phase 7.
