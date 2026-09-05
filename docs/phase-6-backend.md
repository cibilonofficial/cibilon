# Phase 6 — Payouts, Notifications, and Support

Phase 6 completes the operational loop after lender disbursal. It atomically generates an advisor
payout from the effective versioned commission rule, exposes per-recipient notifications, and adds
advisor-owned support tickets with staff assignment and message threads.

## Business and security decisions

- A transition from `APPROVED` to `DISBURSED` requires `lenderId` and the actual
  `disbursedAmount`.
- Application status, lender/disbursal facts, payout, initial payout history, advisor notification,
  timeline entry, and audit entry are committed in one database transaction.
- `payouts.application_id` is unique. A retry or concurrent disbursal cannot create a second payout.
- The effective lender-specific commission is selected at disbursal time; if none exists, the
  effective product default is used.
- Payouts store the commission-rule ID, version, calculation type, percentage/flat value,
  disbursed amount, and calculated payout amount. Later commission changes cannot alter history.
- Percentage calculations use integer scaled arithmetic and round to paise, avoiding binary
  floating-point payout errors.
- Paid payouts require a UTR/payment reference and paid timestamp at API and database levels.
- Notifications always have one `recipient_user_id`. No audience-wide notification can leak an
  advisor's application, payout, or ticket.
- Advisors can access only their own payouts and tickets. Internal support messages are never
  returned to advisors.

## Disbursal and payout generation

Use the existing status endpoint:

```http
PATCH /api/v1/applications/:id/status
Authorization: Bearer <operations-token>
Content-Type: application/json

{
  "status": "DISBURSED",
  "lenderId": "<mapped-lender-uuid>",
  "disbursedAmount": 100000,
  "remarks": "Disbursed in full"
}
```

The application must currently be `APPROVED`, the lender must be active for the product, and an
effective commission rule must exist.

## Payout APIs

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/payouts` | `payouts:read:self` or `payouts:read:any` | Search/filter/sort/page payouts |
| GET | `/payouts/:id` | owned or any-read | Payout, commission snapshot, application, and history |
| GET | `/payouts/:id/history` | owned or any-read | Paginated payout status history |
| PATCH | `/payouts/:id/status` | `payouts:manage` | Process, pay, fail, or cancel a payout |
| POST | `/payouts/bulk/process` | `payouts:manage` | Atomically move up to 100 payouts to processing |
| POST | `/payouts/bulk/pay` | `payouts:manage` | Atomically pay up to 100 payouts with per-row references |

Status transitions are controlled server-side. `PAID` and `CANCELLED` are terminal; `FAILED`
payouts may be retried by returning them to `PROCESSING`.

## Notification APIs

All notification endpoints operate only on the authenticated user's records.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/notifications` | Search/filter/sort/page notifications and return unread count |
| PATCH | `/notifications/:id` | Mark one notification read or unread |
| PATCH | `/notifications/read-all` | Mark all current-user notifications read |

Responses include application, payout, ticket, or lead IDs where applicable plus a normalized
`resource` object for frontend navigation.

## Support APIs

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/support/tickets` | `support:read:self` or `support:read:any` | Filtered ticket list |
| POST | `/support/tickets` | `support:create:self` or `support:manage` | Create a ticket with initial message |
| GET | `/support/tickets/:id` | owned or any-read | Ticket detail and visible messages |
| PATCH | `/support/tickets/:id` | `support:manage` | Status, priority, and staff assignment |
| GET | `/support/tickets/:id/messages` | owned or any-read | Paginated message thread |
| POST | `/support/tickets/:id/messages` | `support:message:self` or `support:manage` | Add public/internal message |

Ticket categories are application query, document issue, payout query, account/access, product
information, and other. Priorities are low, normal, high, and urgent. Statuses are open, in
progress, resolved, and closed.

## Migration

```bash
npm run db:migrate:deploy
npm run db:seed
```

The migration creates `payouts`, `payout_status_history`, `support_tickets`, and
`ticket_messages`; adds lender and disbursal facts to `applications`; and adds payout/ticket links
to `notifications`.

## Verification

```bash
npm run dev:api
node scripts/phase6-smoke.mjs
```

The smoke suite covers atomic disbursal, exact-one payout behavior, the commission snapshot,
missing-UTR rejection, bulk processing/payment, payout ownership, ticket ownership, assignment,
public/internal messages, ticket status, per-user notification isolation, read/unread operations,
and audit entries.

Compilation and schema checks:

```bash
npm run typecheck
npm run build
npm run build:api
npx prisma migrate status
```
