# Phase 8 — Security, Testing, Monitoring, Backups, and Deployment

Phase 8 hardens the completed modular monolith and adds repeatable verification and operations
runbooks. It does not add external lender, KYC, payment, or messaging integrations.

## Security controls

- Helmet supplies API security headers and removes framework disclosure.
- CORS accepts a comma-separated allowlist from `FRONTEND_ORIGIN`; requests without an Origin
  remain available to trusted server-to-server clients.
- Global, authentication, and failed-login rate limits are independently configurable. Limit
  events are structured security logs and return stable JSON errors.
- Access tokens are short-lived, issuer/audience constrained HS256 JWTs. Opaque refresh tokens are
  stored only as SHA-256 hashes, rotated on use, carried in HttpOnly cookies, and revoked on logout
  or password changes.
- Refresh cookies default to `SameSite=Strict`. Production startup rejects insecure cookies,
  non-HTTPS frontend origins, placeholder JWT secrets, missing metrics authentication, or a missing
  separate document encryption key.
- Zod schemas validate route parameters, queries, and request bodies. Uploads additionally validate
  declared MIME type, content magic bytes, count, and size before storage.
- PAN, Aadhaar, lead bank accounts, and advisor bank accounts are encrypted with AES-256-GCM and
  masked by default. Explicit unmasked advisor access requires a permission and produces an audit
  record.
- New local document objects are encrypted with AES-256-GCM using `DOCUMENT_ENCRYPTION_KEY`.
  Existing pre-Phase-8 plaintext objects remain readable for migration compatibility. S3 uploads
  request SSE-S3 by default or SSE-KMS when `S3_KMS_KEY_ID` is configured.
- Document downloads, report downloads, authentication security events, and sensitive advisor
  reads are audited. API errors never expose stacks, storage paths, tokens, or database details.
- Request logging omits query values and redacts credentials and sensitive-field names.

Keep application encryption keys in a managed secret store, grant decrypt access only to API and
worker identities, and back up key versions separately from ciphertext. Rotate JWT and metrics
secrets directly. Data/document-key rotation requires decrypt-and-re-encrypt migration because
existing ciphertext is tied to its current key.

## Automated tests

```bash
npm test
```

The pre-test script derives or accepts `TEST_DATABASE_URL`, refuses any database name that does not
end in `_test`, resets only its `public` schema, deploys every migration, and seeds deterministic
accounts/catalog data. Set `TEST_DATABASE_URL` explicitly in CI; otherwise it derives
`<development_database>_test` from `DATABASE_URL`.

The suite includes unit and API integration coverage for:

- Application status transitions and terminal states
- Percentage/flat payout calculations and disbursal validation
- Payout creation idempotency under a repeated disbursal request
- JWT authentication, admin/advisor RBAC, and database-backed advisor ownership
- MIME/content upload validation and encrypted local-document round trips
- Sensitive encryption/masking and production environment safeguards
- Helmet headers, CORS allowlisting, liveness/readiness, protected metrics, and login throttling

Individual commands are `npm run test:unit` and `npm run test:integration`. Run `npm test` for a
clean, seeded integration database.

## Monitoring

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health/live` | Process liveness; does not depend on PostgreSQL |
| GET | `/api/v1/health/ready` | Readiness; returns 503 when PostgreSQL is unavailable |
| GET | `/api/v1/health` | Backward-compatible readiness alias |
| GET | `/api/v1/metrics` | In-process HTTP/process snapshot; requires `X-Metrics-Token` |

Logs are newline-delimited Pino JSON with ISO timestamps, service/environment fields, request IDs,
status codes, latency, and structured errors. Ship stdout/stderr to the platform log collector and
alert on readiness failures, 5xx rate, repeated rate-limit events, worker failures, export queue age,
database saturation, memory growth, and disk/object-store capacity. The metrics endpoint is a basic
authenticated snapshot; use an OpenTelemetry/Prometheus exporter before multi-instance production
autoscaling so counters can be aggregated centrally.

## Backup and restore plan

For self-hosted PostgreSQL, `npm run backup:db` creates a timestamped custom-format `pg_dump` without
putting the password in command arguments. It uses `DIRECT_URL` when configured and requires
PostgreSQL client tools. Restore into a new
database and verify before cutover:

```bash
createdb cibilon_restore
pg_restore --clean --if-exists --no-owner --dbname cibilon_restore backups/database/<file>.dump
```

Use a managed PostgreSQL service with point-in-time recovery in production: retain PITR logs for at
least 14 days, nightly encrypted snapshots for 35 days, and monthly snapshots for one year. Copy
backups to a separate account/region and perform a documented restore drill quarterly.

For local document/export storage, `npm run backup:files` creates a timestamped copy under
`FILE_BACKUP_DIR`. Document blobs remain encrypted. Coordinate database and file snapshots inside
the same maintenance window and retain the encryption keys. For S3-compatible production storage,
enable versioning, provider-side encryption/KMS, lifecycle expiry for exports, cross-region or
cross-account replication, and deletion protection. Test restoring both metadata and blobs.

## Production deployment

1. Copy `.env.production.example` to an untracked `.env.production` and replace every placeholder.
   Generate secrets with a cryptographic secret manager; both encryption keys are 32-byte hex and
   must differ.
2. Terminate TLS at the load balancer/ingress, set the public HTTPS origin in `FRONTEND_ORIGIN`, and
   restrict database/object-storage networking to the application network.
3. Build and verify:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   npm run build:api
   ```

4. Take a verified database/storage backup, then deploy migrations once:

   ```bash
   npm run db:migrate:deploy
   ```

5. Run `npm run db:seed` only for a new environment or an intentional permission/catalog refresh.
   Supply a one-time `SEED_DEFAULT_PASSWORD`, rotate seeded credentials immediately, and never put
   that value in source control.
6. Start API and worker processes with `npm run start:api` and `npm run start:worker`; serve `dist/`
   from a hardened web server/CDN. Wait for readiness before accepting traffic.

The supplied multi-stage `Dockerfile`, hardened SPA/proxy Nginx configuration, and
`docker-compose.production.yml` provide `web`, `api`, `worker`, one-shot `migrate`, and PostgreSQL
services. The compose stack is suitable for a single-host deployment; use managed PostgreSQL and
object storage for higher availability.

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up --build -d
```

For rolling deployments, run migrations as a separate release job, deploy the worker, deploy API
instances behind readiness checks, then deploy the frontend. Migrations must remain backward
compatible until all old API instances are drained.

## Database changes

Phase 8 adds no tables or schema migration. It validates and deploys the seven existing migrations.

## Remaining operational decisions

- Select the production secret manager/KMS and formalize key rotation ownership.
- Select the managed PostgreSQL and S3-compatible providers and set recovery objectives.
- Replace the placeholder malware scanner before accepting untrusted production uploads.
- Add centralized tracing and multi-instance metrics aggregation.
- Re-encrypt legacy plaintext local documents or migrate them to encrypted object storage.
