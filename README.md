# Cibilon — Loan & Financial Services CRM

A full-stack loan-processing advisor CRM. It covers the
whole workflow — **Advisor login → lead capture → service selection → document upload → submission →
admin processing → status updates → payout** — plus a Super Admin operations console.

The React frontend is connected to the Express/
PostgreSQL foundation, authentication and RBAC from Phase 1; customer, lead, draft, activity,
follow-up, and conversion APIs from Phase 2; application processing, assignment, controlled status,
remarks, timeline, notification, and workload APIs from Phase 3; and secure document storage,
versioning, download, rejection, and verification APIs from Phase 4. Phase 5 adds advisor bank and
profile administration, role-aware staff management, lender and product configuration, eligibility,
document checklists, turnaround settings, lender mapping, and immutable versioned commission rules.
Phase 6 adds atomic payout generation on disbursal, version-pinned commission calculations, bulk
payout processing, per-user notifications, and advisor-owned support tickets with staff assignment
and message threads. Phase 7 adds dashboard/report APIs, permission-aware global search, asynchronous
CSV/PDF exports, and live frontend authentication, data, uploads, drafts, password recovery/change,
support, notification, and reporting flows. Phase 8 adds production security gates, configurable
rate limiting/CORS, encrypted local documents, health/readiness/metrics endpoints, automated unit
and integration tests, backup tooling, and container deployment assets. Phase 9 adds pooled/direct
Neon PostgreSQL configuration and safe connection verification.

## Running it

```bash
npm install
```

```bash
npm run dev
```

In separate terminals, start the API and export worker:

```bash
npm run dev:api
npm run dev:worker
```

The app serves on http://localhost:5173 and the API on http://127.0.0.1:4000.

```bash
npm run build
```

Run the complete isolated test suite:

```bash
npm test
```

## Phase 1 backend

The backend is a modular Express monolith under `server/src`, using PostgreSQL and Prisma. See
[`docs/phase-1-backend.md`](docs/phase-1-backend.md) for setup, API contracts, seed accounts, and
manual verification steps.

```bash
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:seed
npm run dev:api
```

The API serves on http://127.0.0.1:4000 and the health endpoint is
`GET /api/v1/health`.

Phase documentation:

- [`docs/api-reference.md`](docs/api-reference.md)
- [`docs/phase-1-backend.md`](docs/phase-1-backend.md)
- [`docs/phase-2-backend.md`](docs/phase-2-backend.md)
- [`docs/phase-3-backend.md`](docs/phase-3-backend.md)
- [`docs/phase-4-backend.md`](docs/phase-4-backend.md)
- [`docs/phase-5-backend.md`](docs/phase-5-backend.md)
- [`docs/phase-6-backend.md`](docs/phase-6-backend.md)
- [`docs/phase-7-backend.md`](docs/phase-7-backend.md)
- [`docs/phase-8-security-deployment.md`](docs/phase-8-security-deployment.md)
- [`docs/phase-9-neon.md`](docs/phase-9-neon.md)

Production environment, security, backup, monitoring, migration, and Docker instructions are in
the Phase 8 runbook. The quick container deployment uses:

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up --build -d
```

### Demo accounts

Both use `SEED_DEFAULT_PASSWORD` from the environment (the development example is `cibilon@123`).

| Role | Email |
| --- | --- |
| Financial Advisor / DSA | `advisor@cibilon.in` |
| Super Admin (operations) | `admin@cibilon.in` |

The session persists in `localStorage` when "Remember me" is ticked, `sessionStorage` otherwise.

## What is included

**Advisor workspace** (`/app`)

- Dashboard — 8 stat tiles, submissions-vs-disbursals bars, status donut, action queue, payout trend
- Leads — search, stage/status/service/date filters, pagination, view & edit
- Lead details — customer, requirement and employment panels, stage control, activity log (calls,
  meetings, emails, notes), document readiness and a jump to the application
- Add New Lead — 6-step wizard (customer → employment → service → service details → documents →
  review) with per-step validation, service-driven conditional fields, an indicative EMI calculator,
  multipart document upload, draft saving, and a generated Application ID on submit
- Applications — tabbed views, filters, per-file document-completeness bars
- Application details — customer/employment/service panels, document list with re-upload, a visual
  pipeline timeline that highlights the current stage, activity log, payout panel
- Documents — centralised document register with preview and re-upload for anything the desk
  bounced, plus documents the ops desk has explicitly requested
- Payouts — earnings tiles, trend chart, filterable payout register
- Notifications — read/unread, filtered by kind
- Profile — advisor identity, agency, payout bank account, security
- Support — raise and track tickets against a file, threaded replies, contact details and FAQs

**Super Admin console** (`/admin`)

- Dashboard — 9 network-level tiles, portfolio volume, status split, processing queue, top advisors,
  service mix
- Leads — network-wide lead register with stage/status/advisor/service/date filters, inline stage
  changes and staff assignment
- Applications — network-wide list with an inline **status update** control that writes a timeline
  event, notifies the advisor, and auto-raises a payout when a file reaches Disbursed; plus assign
  and request-document actions
- Document verification — queue with a preview dialog carrying verify / reject / request-re-upload,
  each with a reason sent through to the advisor
- Advisors — per-partner rollup, a full advisor profile (performance, applications, payout history,
  support) and activate / deactivate
- Team / Staff — internal roster, per-role permissions, workload, assignment of unowned files,
  add member and activate / deactivate
- Lenders & partners — panel list with type/status/service filters, add & edit, per-service
  commission, turnaround and desk notes
- Products & services — the eight distributed products with limits, interest bands, payout
  economics, editable document checklists and eligibility, and per-product lender mapping
- Payout management — bulk selection and release, per-row status control, payout history
- Reports — advisor performance, application statistics, disbursement, payouts and lender/service
  reports behind shared service and date-range controls
- Audit logs — user, action, module, application/lead and timestamp, filterable by module, user,
  role and date

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router 7 · Recharts · Lucide icons.

## Layout of the source

```
src/
  components/
    charts/      Recharts wrappers (donut, bars, area, horizontal bars)
    crm/         FilterBar (search + filter + date-range toolbar), DocumentPreviewModal,
                 AssignStaffModal, RequestDocumentModal — shared across both workspaces
    layout/      AppLayout shell, collapsible Sidebar, Topbar, mobile drawer, ⌘K search
    ui/          Button, Field (Input/Select/Textarea/RadioCards/Checkbox), Card, Table,
                 StatusBadge, StatCard, Modal + ConfirmDialog, Toast, Pagination, FileUpload,
                 Timeline + Stepper, Feedback (Skeleton/EmptyState), Misc (Avatar/Tabs/Progress)
  data/          Legacy prototype fixtures retained for visual reference; not imported at runtime
  lib/           api.ts (authenticated API client), constants.ts, metrics.ts, utils.ts
  pages/         auth/ · advisor/ · admin/ · shared/ (ApplicationDetails, LeadDetails,
                 Notifications)
  store/         AuthContext (login/refresh/logout) · DataContext (API-backed CRM state + actions)
  types/         Domain model
```

## Deliberately out of scope

Public marketing site, advisor registration, subscription plans, payment gateway, real lender/bank
APIs, real KYC, and real SMS/WhatsApp notifications.
