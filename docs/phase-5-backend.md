# Phase 5 — Network, Staff, Lenders, and Products

Phase 5 adds the operational configuration backend for advisors, internal staff, lenders, and
products. All endpoints are under `/api/v1`, require a bearer access token, use Zod request
validation, and emit audit records for mutations.

## Data and security decisions

- Advisor PAN and bank account numbers are encrypted with AES-256-GCM. Normal profile responses
  return only `••••` plus the last four characters.
- Full PAN and account values are exposed only through explicit `sensitive` endpoints guarded by
  dedicated permissions. Every successful access is audited as `ADVISOR_SENSITIVE_DATA_ACCESSED`.
- Advisor and staff activation uses the existing `users.status`. Suspending or deactivating either
  profile revokes all active refresh sessions.
- Staff have an operational role plus direct permissions. Effective permissions are the union of
  the base `staff` role and their direct assignments; staff-account mutations remain admin-only.
- Lender/product writes require both the admin role and their manage permission. Lenders and
  products are soft-deactivated, preserving references and reporting history.
- Commission rules are append-only. Creating a rule closes the current version and creates the next
  version in a serializable transaction. There is intentionally no update or delete endpoint.
- Product eligibility, document checklists, lender mappings, product turnaround, lender turnaround,
  and mapping-specific turnaround are independently configurable.

## API contracts

### Advisors

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/advisors/me` | `advisors:read:self` | Read own masked profile |
| PATCH | `/advisors/me` | `advisors:update:self` | Update own profile |
| GET/PUT | `/advisors/me/bank-account` | self read/update | Read or replace own masked bank account |
| GET | `/advisors/me/sensitive` | `advisors:sensitive:read:self` | Read own full sensitive values and audit access |
| GET/POST | `/advisors` | `advisors:read:any` / `advisors:create` | Search or create advisors |
| GET/PATCH | `/advisors/:id` | owned or any-profile permission | Read or update a profile |
| PATCH | `/advisors/:id/status` | `advisors:status:update` | Activate, suspend, or deactivate |
| GET/PUT | `/advisors/:id/bank-account` | owned or any-profile permission | Read or replace a bank account |
| PATCH | `/advisors/:id/bank-account/status` | `advisors:bank:verify` | Verify or reject bank details |
| GET | `/advisors/:id/sensitive` | owned or any-sensitive permission | Read full values and audit access |

Rejections require a reason. Replacing a bank account always returns it to
`PENDING_VERIFICATION`.

### Staff

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/staff/me` | authenticated staff | Own role, permissions, and workload |
| GET | `/staff/permissions/catalog` | `staff:read:any` | Available permission codes |
| GET/POST | `/staff` | `staff:read:any` / `staff:manage` | Search or create staff |
| GET/PATCH | `/staff/:id` | read/manage | Read or update staff |
| PATCH | `/staff/:id/status` | `staff:manage` | Activate, suspend, or deactivate |
| PUT | `/staff/:id/permissions` | `staff:manage` | Replace direct permissions |

Staff roles are `OPERATIONS_MANAGER`, `CREDIT_ANALYST`, `VERIFICATION_OFFICER`,
`PAYOUT_EXECUTIVE`, and `RELATIONSHIP_MANAGER`. Workload includes current/open applications and
total historical assignments.

### Lenders

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/lenders` | `lenders:read` | Filtered, sorted, paginated list |
| POST | `/lenders` | `lenders:manage` | Create lender |
| GET | `/lenders/:id` | `lenders:read` | Lender detail and mapping/rule counts |
| PATCH | `/lenders/:id` | `lenders:manage` | Edit details, status, and turnaround |
| DELETE | `/lenders/:id` | `lenders:manage` | Soft-deactivate lender and mappings |

Lender types are `BANK`, `NBFC`, `HFC`, `FINTECH`, and `INSURER`; statuses are `ACTIVE`,
`PAUSED`, and `INACTIVE`.

### Products and commission rules

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/products` | `products:read` | Products with eligibility, checklist, and lenders |
| POST | `/products` | `products:manage` | Create product configuration |
| GET/PATCH | `/products/:id` | read/manage | Read or edit product configuration |
| DELETE | `/products/:id` | `products:manage` | Soft-deactivate product |
| PUT | `/products/:id/lenders` | `products:manage` | Atomically replace lender mappings |
| GET | `/products/:id/commission-rules` | `products:manage` | Read immutable rule history |
| POST | `/products/:id/commission-rules` | `products:manage` | Close current rule and create next version |

Commission rules may apply to a product by default (`lenderId: null`) or to one mapped lender.
They use either `PERCENTAGE` with `percentageRate`, or `FLAT` with `flatAmount`.

## Migration and seed

Apply the Phase 5 migration and idempotent seeds:

```bash
npm run db:migrate:deploy
npm run db:seed
```

The migration creates `user_permissions`, `advisor_bank_accounts`, `lenders`, `products`,
`product_lenders`, `product_eligibility`, `product_documents`, and `commission_rules`, adds advisor
profile fields and the staff operational role, and enforces commission value/range constraints.

The seed adds Phase 5 permissions, eight baseline product configurations, their document
checklists and eligibility, three lenders, lender mappings, and initial default commission versions.
Existing product configuration and commission history are not overwritten on subsequent runs.

## Verification

Start the API and run the reusable smoke test in another terminal:

```bash
npm run dev:api
node scripts/phase5-smoke.mjs
```

The smoke test performs 32 API checks covering role boundaries, advisor masking/unmasking and audit,
bank verification, staff creation and direct permission changes, product editing, lender mapping,
two immutable commission versions, soft deactivation, and session revocation.

For full compilation checks:

```bash
npm run typecheck
npm run build
npm run build:api
```
