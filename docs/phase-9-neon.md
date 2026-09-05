# Phase 9 — Neon PostgreSQL integration

Phase 9 prepares Cibilon to use Neon as its managed PostgreSQL provider without changing the
modular Express/Prisma architecture.

## Connection model

Cibilon uses two Neon connection strings from the project's **Connect** dialog:

- `DATABASE_URL`: the pooled hostname containing `-pooler`; used only by the API and export worker.
- `DIRECT_URL`: the non-pooled hostname; used by Prisma migrations, seeding, database verification,
  `pg_dump`, and other administrative operations.

The API uses one long-lived Prisma client backed by `@prisma/adapter-pg`. Each API/worker process
defaults to a maximum of ten pool connections. Tune the pool per instance so the combined maximum
across replicas remains inside the Neon compute's connection budget.

Copy `.env.neon.example` values into the ignored local `.env` or production secret manager. Never
put either URL in frontend variables or source control. URL-encode special characters in database
passwords.

## Initial test-project setup

1. Create a Neon project in the region closest to the API deployment.
2. Copy the pooled and direct URLs from **Connect** into `DATABASE_URL` and `DIRECT_URL`.
3. Generate a strong temporary seed password and set `SEED_DEFAULT_PASSWORD`.
4. Apply the seven checked-in migrations over the direct connection:

   ```bash
   npm run db:migrate:deploy
   ```

5. Seed roles, permissions, demo identities, lenders, products, document checklists, and commission
   rules:

   ```bash
   npm run db:seed
   ```

6. Verify both connections without printing credentials:

   ```bash
   npm run db:check
   ```

The check reports safe host/database metadata, TLS state, migration count, and user count for the
runtime and direct endpoints. Start the API and worker only after both checks succeed.

## Test isolation

Use a separate Neon branch for automated tests. Create a database named `cibilon_test` on that
branch and set its direct connection string as `TEST_DATABASE_URL`. `npm test` refuses to reset a
database whose name does not end in `_test`, then resets only that database's `public` schema before
deploying migrations and seed data.

Never point `TEST_DATABASE_URL` at the staging or production database.

## Deployment

Production and Docker deployments inject both URLs through `.env.production` or a managed secret
store. The one-shot migration container uses `DIRECT_URL`; the API and worker use `DATABASE_URL`.
Run migrations once before rolling out new API instances.

Neon protects database transport with TLS when the URLs contain `sslmode=require`. Cibilon retains
application-layer AES-256-GCM encryption for PAN, Aadhaar, bank details, and local document objects.
Database hosting does not replace application-level RBAC, ownership checks, masking, or audit logs.

## Backup and recovery

Neon's restore history/branch restore is the primary short-term recovery mechanism. Continue
periodic logical backups using `npm run backup:db`; that script automatically selects `DIRECT_URL`.
Store dumps encrypted in another provider/account and perform quarterly restore drills.

## Database changes

Phase 9 adds no schema migration or tables. It changes connection configuration and deployment
behavior only; all seven existing migrations are applied unchanged to Neon.

## Acceptance checks

- Pooled runtime and direct administrative endpoints both connect with TLS.
- All seven migrations are present on Neon.
- Seed roles and demo identities exist.
- API readiness reports PostgreSQL connected while using Neon.
- Login, advisor ownership, reports, exports, and payout idempotency regression checks pass.
