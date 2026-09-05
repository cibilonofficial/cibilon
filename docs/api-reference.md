# Cibilon REST API reference

The API is versioned under `/api/v1`. JSON successes use `{ "data": ... }`; list responses also
include `pagination`. Errors use `{ "error": { "code", "message", "requestId", "details?" } }`.
Protected endpoints require `Authorization: Bearer <access-token>`. Refresh tokens are rotating,
opaque HttpOnly cookies and are never returned in JSON.

All list endpoints accept the module-appropriate combination of `search`, filters, `dateFrom`,
`dateTo`, `sortBy`, `sortOrder`, `page`, and `pageSize`. Page size is capped at 100. Every identifier
path parameter is validated as a UUID, and advisor access is scoped using ownership read from the
database.

## Endpoint groups

| Group | Base path | Detailed contracts |
| --- | --- | --- |
| Health, authentication, current user, audit | `/health`, `/auth`, `/me`, `/audit-logs` | [Phase 1](phase-1-backend.md) and [Phase 8](phase-8-security-deployment.md) |
| Customers, leads, activities, conversion | `/customers`, `/leads` | [Phase 2](phase-2-backend.md) |
| Applications, assignment, status, timeline, remarks | `/applications` | [Phase 3](phase-3-backend.md) |
| Document requests, uploads, versions, downloads | `/applications/:id/documents`, `/documents` | [Phase 4](phase-4-backend.md) |
| Advisors, staff, lenders, products, commission rules | `/advisors`, `/staff`, `/lenders`, `/products` | [Phase 5](phase-5-backend.md) |
| Payouts, notifications, support tickets | `/payouts`, `/notifications`, `/support/tickets` | [Phase 6](phase-6-backend.md) |
| Dashboards, reports, exports, global search | `/reports`, `/search` | [Phase 7](phase-7-backend.md) |
| Operational metrics | `/metrics` | [Phase 8](phase-8-security-deployment.md) |

The linked phase documents contain methods, complete route paths, permission requirements,
business rules, payload constraints, and verification examples. The route schemas under
`server/src/modules/*/*.schemas.ts` are the executable source of truth for request contracts.

## Status codes

| Code | Meaning |
| --- | --- |
| 200/201/202/204 | Successful read/create/accepted/no-content operation |
| 400 | Invalid JSON or business precondition |
| 401 | Missing, invalid, expired, or revoked authentication |
| 403 | RBAC, ownership, CORS, or other authorization denial |
| 404 | Route or owned resource not found |
| 409 | Invalid transition, concurrency conflict, or duplicate state |
| 413 | Body or document exceeds configured size |
| 422 | Schema or document-content validation failure |
| 429 | Global/authentication/login rate limit exceeded |
| 503 | Readiness dependency or metrics configuration unavailable |

Use the response `x-request-id`/`error.requestId` when correlating a client failure with structured
server and audit logs.
