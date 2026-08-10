# Cibilon — Loan & Financial Services CRM (frontend)

A production-shaped frontend prototype for a loan-processing company's advisor CRM. It covers the
whole workflow — **Advisor login → lead capture → service selection → document upload → submission →
admin processing → status updates → payout** — plus a Super Admin operations console.

Everything runs on mock data held in React state. There is no backend, no database and no third-party
integration; the UI behaves as if the API already exists.

## Running it

```bash
npm install
```

```bash
npm run dev
```

The app serves on http://localhost:5173.

```bash
npm run build
```

### Demo accounts

Both use the password `cibilon@123`. The login page has one-click buttons for each.

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
  drag-and-drop upload with progress, and a generated Application ID on submit
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
  data/          mockData.ts (advisors, applications, documents, payouts, notifications),
                 team.ts, lenders.ts, products.ts, audit.ts, support.ts
  hooks/         useMockLoading — stands in for a query's pending state so skeletons are exercised
  lib/           constants.ts (statuses, tones, checklists, payout rates), metrics.ts, utils.ts
  pages/         auth/ · advisor/ · admin/ · shared/ (ApplicationDetails, LeadDetails,
                 Notifications)
  store/         AuthContext (login/logout) · DataContext (all CRM state + actions)
  types/         Domain model
```

## Wiring a backend in later

The seams are deliberate:

- **Auth** — `AuthContext.login` is a `Promise<string | null>` that sleeps and matches against
  `DEMO_ACCOUNTS`. Replace the body with a `fetch` to `POST /auth/login`; nothing else changes.
- **Data** — every mutation lives on `DataContext` (`submitApplication`, `updateApplicationStatus`,
  `replaceDocument`, `setDocumentStatus`, `requestDocument`, `assignApplication`, `updateLeadStage`,
  `saveLender`, `updateProduct`, `updatePayoutStatus`, …). Each is a single `useCallback`
  operating on local state; swap each for an API call plus a refetch, or drop the whole provider in
  favour of TanStack Query and keep the same function signatures.
- **Uploads** — `simulateUpload()` in `components/ui/FileUpload.tsx` ticks a fake progress bar.
  Replace it with real XHR/fetch progress events; the `UploadedFile` shape already carries
  `progress`, `status` and `size`.
- **Seed data** — everything in `data/` is imported only by `DataContext`. Swapping the seeds for an
  API hydration is a one-file change.
- **Audit trail** — `DataContext` writes an `AuditEntry` for every mutation, attributed to whoever
  `setAuditActor` last recorded (the layout sets it from the session). Point `pushAudit` at the API
  and the console keeps working unchanged.
- **Loading states** — `useMockLoading()` is used wherever a query's `isLoading` will go.

## Deliberately out of scope for this phase

Public marketing site, advisor registration, subscription plans, payment gateway, real lender/bank
APIs, real KYC, real SMS/WhatsApp notifications, backend and database.
