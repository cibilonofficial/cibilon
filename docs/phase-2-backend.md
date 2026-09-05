# Phase 2 backend: customers, leads, drafts, activities, and conversion

## Scope

Phase 2 adds persistent customers and leads while keeping leads and applications as separate database
entities. It supports incomplete drafts, active unconverted leads, activity history, scheduled
follow-ups, archival, and an atomic lead-to-application conversion.

PAN, Aadhaar, and bank account numbers are encrypted with AES-256-GCM before they reach PostgreSQL.
Normal API responses omit ciphertext and raw last-four fields, returning only `panMasked`,
`aadhaarMasked`, and `bankAccountMasked`. Set `DATA_ENCRYPTION_KEY` to a unique 64-character
hexadecimal key in every non-development environment and back it up securely.

## Database changes

Migration: `prisma/migrations/20260902090000_phase_2_leads_conversion/migration.sql`

Tables added:

- `customers`
- `leads`
- `lead_activities`
- `application_counters`
- `applications`
- `application_status_history`
- `notifications`
- `document_requests`

The `document_requests` table is created now solely because the required checklist must be part of
the conversion transaction. Uploads, verification, rejection, versions, and document APIs remain in
Phase 4.

Apply the migration and refresh seeded permissions:

```bash
npm run db:migrate:deploy
npm run db:seed
```

## APIs added

### Customers

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/customers` | Search, filter, sort, and paginate customers |
| POST | `/api/v1/customers` | Create a complete customer |
| GET | `/api/v1/customers/:id` | Get a masked customer |
| PATCH | `/api/v1/customers/:id` | Update customer fields |
| DELETE | `/api/v1/customers/:id` | Archive a customer |

### Leads

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/leads` | Search, filter, sort, and paginate leads |
| POST | `/api/v1/leads` | Create an active lead |
| POST | `/api/v1/leads/drafts` | Create an incomplete draft |
| GET | `/api/v1/leads/:id` | Get lead details |
| PATCH | `/api/v1/leads/:id` | Update an unconverted lead |
| PUT | `/api/v1/leads/:id/draft` | Save an existing draft |
| DELETE | `/api/v1/leads/:id` | Archive an unconverted lead |
| GET | `/api/v1/leads/:id/activities` | List activities |
| POST | `/api/v1/leads/:id/activities` | Add a call, meeting, email, or note |
| POST | `/api/v1/leads/:id/follow-ups` | Schedule a follow-up |
| PATCH | `/api/v1/leads/:id/follow-ups/:activityId/complete` | Complete a follow-up |
| POST | `/api/v1/leads/:id/convert` | Atomically create an application |

Customer list parameters include `search`, `advisorId`, `city`, `state`, `archived`, `dateFrom`,
`dateTo`, `sortBy`, `sortOrder`, `page`, and `pageSize`.

Lead list parameters include `search`, `advisorId`, `customerId`, `status`, `stage`, `serviceType`,
follow-up/date ranges, sorting, and pagination. Activity lists support search, kind, completion state,
date ranges, sorting, and pagination.

## Ownership and permissions

- Advisors can create and access only records owned by their advisor profile.
- An advisor-supplied `advisorId` cannot redirect writes to another advisor.
- Admin/staff visibility is controlled by `*:read:any` and `*:update:any` permissions.
- Ownership is resolved from PostgreSQL, never from request-body claims.
- Converted and archived leads cannot be edited; converted leads cannot be archived.
- The `CONVERTED` stage can only be reached through the conversion API.

Re-run `npm run db:seed` after migration so existing roles receive the Phase 2 customer permissions.

## Conversion transaction

`POST /api/v1/leads/:id/convert` checks customer, employment, service-specific, and sensitive-data
completeness. A serializable transaction with retry protection then creates or updates all of the
following as one unit:

1. Claims the lead and marks it `CONVERTED`.
2. Generates `CBL-YYYYMM-######` through an atomic monthly counter.
3. Creates the application with masked snapshots.
4. Creates the initial `SUBMITTED` status-history record.
5. Creates the server-owned document checklist.
6. Creates the conversion activity.
7. Creates a notification for the specific advisor user.
8. Creates the audit record.

The unique application-to-lead constraint and conditional lead claim prevent duplicate conversion.

## Example flow

Use the Phase 1 login instructions to obtain an advisor access token, then create a draft:

```powershell
$headers = @{ Authorization = "Bearer $accessToken" }
$draft = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:4000/api/v1/leads/drafts' `
  -Method Post `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"customer":{"fullName":"Example Customer"},"serviceType":"Personal Loan"}'
```

Save additional form sections with `PUT /api/v1/leads/:id/draft`. Conversion returns `422
LEAD_INCOMPLETE` with `missingFields` until all required customer, employment, bank, and
service-specific values are present.

Useful checks:

- Advisor A requesting Advisor B's customer or lead returns `403`.
- List endpoints for an advisor return only that advisor's rows.
- Repeating conversion returns `409` and does not create another application.
- Archived and converted leads reject updates.
- Customer and lead responses contain masks but no ciphertext or complete PAN/Aadhaar/account data.
- The created notification has one `recipient_user_id`, never a generic audience.

## Verification commands

```bash
npx prisma validate
npm run typecheck
npm run build:api
npm run build
npm audit --omit=dev
```

The frontend remains on mock state until the integration phase. Phase 3 will add application list,
detail, assignment, remarks, status-transition, and timeline APIs.
