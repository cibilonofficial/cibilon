# Phase 3: application processing workflow

Phase 3 adds the operations workflow around applications created by Phase 2 conversion. It covers
advisor-scoped reads, operations assignment, controlled status transitions, remarks, activities,
status history, the processing timeline, staff workload, recipient-specific notifications, and
auditing of every write.

## Database

Migration: `prisma/migrations/20260902170000_phase_3_application_workflow/migration.sql`

The migration adds:

- `applications.assigned_staff_id` and `applications.assigned_at`
- `application_assignments`, including assignment start/end history
- `application_remarks`, with shared or internal visibility
- `application_activities`, the normalized processing timeline
- `ApplicationActivityKind`
- `DRAFT` to `ApplicationStatus` for workflow completeness
- `APPLICATION_ASSIGNED` to `NotificationType`
- a partial unique index allowing only one active assignment per application
- a submission-activity backfill for applications created before Phase 3

New lead conversions now create their initial application activity in the same Phase 2 conversion
transaction.

## Permissions and ownership

- Advisors have `applications:read:self` and can only read their own applications.
- Advisors can add shared remarks and activities to their own applications. Requests attempting to
  mark them internal are forced to shared visibility.
- Staff/admin users with `applications:read:any` may read all applications and internal entries.
- `applications:status:update` is required for status changes.
- `applications:assign` is required for assignment changes.
- `applications:workload:read` is required for staff workload reporting.
- Assignment notes and internal activities/remarks are not returned to advisors.

Ownership is resolved from the application row in PostgreSQL; request bodies are never trusted for
authorization.

## APIs

All routes require a bearer access token.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/applications` | Search, filter, sort, and paginate applications |
| GET | `/api/v1/applications/workload` | Paginated staff workload and status breakdown |
| GET | `/api/v1/applications/:id` | Application detail, document progress, history, and remarks |
| PATCH | `/api/v1/applications/:id/status` | Perform a permitted status transition |
| PUT | `/api/v1/applications/:id/assignment` | Assign, reassign, or clear an active staff owner |
| GET | `/api/v1/applications/:id/status-history` | Filtered status history |
| GET | `/api/v1/applications/:id/timeline` | Filtered processing timeline |
| GET/POST | `/api/v1/applications/:id/activities` | List or add application activities |
| GET/POST | `/api/v1/applications/:id/remarks` | List or add shared/internal remarks |

Application filters include `search`, `advisorId`, `customerId`, `assignedStaffId`, `unassigned`,
`status`, `serviceType`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`, `page`, and `pageSize`.
Secondary lists provide applicable kind/status/visibility filters along with search, date range,
sort order, and pagination. Workload provides staff search, department/account-status/date filters,
sorting, and pagination.

## Status workflow

The server owns the transition graph:

```text
DRAFT -> SUBMITTED | CANCELLED
SUBMITTED -> UNDER_REVIEW | DOCUMENTS_PENDING | CANCELLED
UNDER_REVIEW -> DOCUMENTS_PENDING | SENT_TO_LENDER | REJECTED | CANCELLED
DOCUMENTS_PENDING -> UNDER_REVIEW | SENT_TO_LENDER | CANCELLED
SENT_TO_LENDER -> LENDER_PROCESSING | DOCUMENTS_PENDING | REJECTED | CANCELLED
LENDER_PROCESSING -> DOCUMENTS_PENDING | APPROVED | REJECTED | CANCELLED
APPROVED -> DISBURSED | CANCELLED
REJECTED | DISBURSED | CANCELLED -> terminal
```

Returning a converted application to `DRAFT` is rejected. `REJECTED` and `CANCELLED` require a
remark. Each successful status change atomically updates the application, inserts status history
and timeline activity, creates a notification for the owning advisor user, and writes an audit log.
A conditional update rejects concurrent transitions.

`DISBURSED` is represented in the transition model but temporarily returns `409`. The global
business rule requires disbursal and exactly-one payout creation to be atomic; commission-rule
versioning arrives in Phase 5 and payout creation in Phase 6. This guard prevents incomplete
financial state until those models exist.

## Assignment and workload

`PUT /api/v1/applications/:id/assignment` accepts:

```json
{
  "staffId": "uuid-or-null",
  "note": "Optional internal handover note"
}
```

Only active staff users may receive applications. Reassignment closes the previous history row and
opens one new row in the same transaction. The assigned staff user and owning advisor receive
separate recipient-specific notifications. Terminal applications cannot be reassigned.

Workload reports each staff member's current/open applications, lifetime assignment count, and
current status breakdown.

## Manual verification

Start PostgreSQL, apply/seed the database, and run the API:

```bash
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:seed
npm run dev:api
```

Login using the Phase 1 demo accounts, then verify:

1. Advisor `GET /applications` returns only owned applications.
2. An advisor requesting another advisor's application receives `403`.
3. An advisor calling the status or assignment API receives `403`.
4. Assign an application to the seeded staff member; workload increases and two recipient-specific
   assignment notifications are persisted.
5. Move `SUBMITTED -> UNDER_REVIEW -> SENT_TO_LENDER -> LENDER_PROCESSING -> APPROVED`.
6. Try `SUBMITTED -> APPROVED`; expect `409`.
7. Try `CANCELLED` or `REJECTED` without remarks; expect `422`.
8. Add an internal staff remark and a shared remark; the advisor sees only the shared entry.
9. Compare advisor and staff timeline results; internal handover entries are hidden from the advisor.
10. Confirm each assignment, remark, activity, and status write has an audit record.

Verification commands:

```bash
npx prisma validate
npm run typecheck
npm run build:api
npm run build
git diff --check
```

The frontend remains on mock data until Phase 7. Document storage and verification are Phase 4.
