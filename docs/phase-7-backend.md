# Phase 7 — Dashboards, Reports, Exports, Search, and Frontend Integration

Phase 7 connects the existing React application to the modular Express API and adds reporting,
global search, and asynchronous file exports. Runtime business records are now hydrated from the
backend rather than the prototype seed modules.

## Reporting and dashboards

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/reports/dashboard/admin` | Network-wide metrics and status/service distributions |
| GET | `/reports/dashboard/advisor` | Current advisor metrics and distributions |
| GET | `/reports/applications` | Filtered application report |
| GET | `/reports/advisors` | Advisor performance report |
| GET | `/reports/payouts` | Payout report |
| GET | `/reports/lenders` | Lender performance report |

Every report is permission-scoped. Advisor requests are restricted to the advisor ID in the
authenticated session; an advisor cannot widen the scope with query parameters.

## Asynchronous exports

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/reports/exports` | Queue a CSV or PDF export |
| GET | `/reports/exports` | List the current user's jobs |
| GET | `/reports/exports/:id` | Read job status |
| GET | `/reports/exports/:id/download` | Download a completed, owned job |

Run the worker separately from the API:

```bash
npm run dev:worker
```

The worker atomically claims one queued job, builds its report using the same permission-aware
report services, stores the result below `EXPORT_STORAGE_PATH`, and creates a per-user
`REPORT_ACTION` notification. CSV is fully implemented. PDF output is a valid, deliberately simple
tabular placeholder suitable for replacement by a richer renderer later. Export paths are never
returned by list/status APIs.

## Global search

```http
GET /api/v1/search?q=HDFC&limit=20
```

Search covers accessible customers, leads, applications, payouts, support tickets, advisors,
lenders, and products. Groups that the user lacks permission to read are omitted.

## Frontend integration

- `AuthContext` uses login, refresh-cookie session restoration, and logout APIs.
- `DataContext` starts empty, hydrates permission-scoped API records, and refetches after mutations.
- Login, forgot password, draft saving, lead conversion, document upload/re-upload/download,
  password change, notification state, support tickets, catalog mutations, and report exports use
  real endpoints.
- Document files are retained in browser memory and submitted as multipart uploads; the old upload
  interval simulation was removed.
- Dashboard chart series are derived from API data, not the former monthly seed series.
- The global search palette debounces requests to `/search`.
- Global loading and retryable error feedback are displayed by the application shell.

The frontend keeps its existing route structure. Its view model adapter maps backend enum and
relation shapes to the types expected by the existing screens while backend IDs remain the source
of truth.

## Migration and configuration

Migration `20260904110000_phase_7_reports_exports` adds `export_jobs`, its indexes and foreign key,
the export/report enums, and the `REPORT_ACTION` notification type.

Environment additions:

```dotenv
EXPORT_STORAGE_PATH=./storage/exports
EXPORT_JOB_POLL_MS=2000
VITE_API_URL=http://localhost:4000/api/v1
```

`VITE_API_URL` is optional; the shown value is the frontend default.

## Verification

With PostgreSQL, the API, and the export worker running:

```bash
npx prisma migrate status
node scripts/phase7-smoke.mjs
npm run typecheck
npm run build
npm run build:api
```

The Phase 7 smoke suite performs more than 30 API checks (the exact count varies with export-job
polling) covering dashboard authorization, advisor-scoped reports, global-search permission
filtering, CSV and PDF job completion, download contents, job ownership isolation, export-list path
masking, and report notifications.

## Remaining decisions

- Export files use local disk in development. Production should attach lifecycle-managed object
  storage and retention cleanup.
- The PDF generator is intentionally minimal; branding, pagination, fonts, and complex layouts are
  deferred.
- The frontend adapter refetches broad lists after a write. A query cache can reduce transfer volume
  once real dataset sizes and invalidation patterns are known.
