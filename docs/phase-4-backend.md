# Phase 4: document storage and verification

Phase 4 replaces simulated document handling with authenticated uploads, immutable versions,
verification/rejection, re-upload, secure downloads, and a local/S3-compatible storage abstraction.

## Database

Migration: `prisma/migrations/20260902190000_phase_4_documents/migration.sql`

The migration adds:

- `documents`: one logical document per application checklist request
- `document_versions`: immutable file metadata and storage references
- rejection reason, reviewer, and review timestamp on `document_requests`
- SHA-256 checksum, MIME type, byte size, uploader, and malware-scan state per version
- unique `(document_id, version)` and storage-key constraints
- `MalwareScanStatus`: `PENDING`, `CLEAN`, `INFECTED`, or `FAILED`
- `DOCUMENT` application timeline activities

Storage objects are never addressed by user-provided file paths. Generated application/document/
UUID keys prevent path traversal and collisions.

## Storage configuration

Local storage is the development default:

```dotenv
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=./storage/documents
MAX_DOCUMENT_SIZE_BYTES=10485760
```

The local directory is excluded from Git and files are written with private permissions where the
operating system supports them.

For S3-compatible storage:

```dotenv
STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3-compatible.example.com
S3_REGION=us-east-1
S3_BUCKET=cibilon-documents
S3_ACCESS_KEY_ID=replace-me
S3_SECRET_ACCESS_KEY=replace-me
S3_FORCE_PATH_STYLE=false
S3_SIGNED_URL_TTL_SECONDS=300
```

S3 writes request server-side AES-256 encryption. Downloads use short-lived signed URLs only after
the API authenticates, authorizes, and audits the request. Normal metadata responses never expose
storage keys, checksums, local paths, or object-store URLs.

## Upload validation and scanning

- Accepted types: PDF, JPEG, and PNG
- Default maximum: 10 MB per file
- Multer uses memory storage and accepts one file per request
- The server validates both the declared MIME type and the file's magic bytes
- Original file names are reduced to a safe basename
- SHA-256 is recorded for integrity and duplicate-analysis hooks
- A malware-scanner interface runs before persistence

The development scanner is intentionally a placeholder. It leaves normal uploads `PENDING` and
rejects the standard EICAR test marker so the integration hook is testable. Production must replace
it with an antivirus service and move scan state to `CLEAN` or `FAILED`. Operations may manually
verify a `PENDING` development upload; `INFECTED` files can never be verified.

If database persistence fails after an object is written, the service attempts to remove the orphan
object. Concurrent version collisions return `409` and can be retried.

## Permissions and ownership

| Permission | Purpose |
| --- | --- |
| `documents:read:self` | Advisor reads/downloads documents on owned applications |
| `documents:read:any` | Operations/admin document access |
| `documents:upload:self` | Advisor uploads/re-uploads on owned applications |
| `documents:upload:any` | Operations/admin upload access |
| `documents:request` | Request an additional checklist item |
| `documents:verify` | Verify or reject an uploaded document |

Advisor ownership is resolved through `document -> application -> advisor`. Cross-advisor metadata,
version, and download requests return `403`. Only staff/admin with `documents:verify` may change
verification state. Terminal applications reject further document requests and uploads.

Every request, upload, re-upload, download, verification, and rejection writes an audit record.
Document requests and review decisions also create application timeline entries and recipient-
specific notifications.

## APIs

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/documents` | Search/filter/sort/paginate document checklist rows |
| GET | `/api/v1/applications/:id/documents` | List one application's checklist and latest versions |
| POST | `/api/v1/applications/:id/document-requests` | Request an additional document |
| POST | `/api/v1/applications/:id/documents` | Initial multipart upload for a checklist request |
| GET | `/api/v1/documents/:id` | Read safe document metadata |
| PATCH | `/api/v1/documents/:id/status` | Verify or reject the latest version |
| GET | `/api/v1/documents/:id/versions` | List immutable version history |
| POST | `/api/v1/documents/:id/versions` | Re-upload as the next version |
| GET | `/api/v1/documents/:id/download` | Download the latest version |
| GET | `/api/v1/documents/:id/versions/:versionId/download` | Download a specific version |

Document lists support applicable `search`, `applicationId`, `advisorId`, `documentType`, `status`,
`required`, `uploaded`, `malwareScanStatus`, `dateFrom`, `dateTo`, sorting, and pagination fields.
Version lists support scan-state/date filtering, sorting, and pagination.

## Examples

Initial upload:

```bash
curl -X POST "http://127.0.0.1:4000/api/v1/applications/APP_UUID/documents" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "documentRequestId=REQUEST_UUID" \
  -F "file=@pan-card.pdf;type=application/pdf"
```

Reject and re-upload:

```bash
curl -X PATCH "http://127.0.0.1:4000/api/v1/documents/DOCUMENT_UUID/status" \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REJECTED","reason":"Image is cropped"}'

curl -X POST "http://127.0.0.1:4000/api/v1/documents/DOCUMENT_UUID/versions" \
  -H "Authorization: Bearer ADVISOR_TOKEN" \
  -F "file=@pan-card-fixed.pdf;type=application/pdf"
```

The re-upload increments the version and moves the checklist status back to `UPLOADED`, clearing
the previous rejection metadata.

## Verification

```bash
npm run db:migrate:deploy
npm run db:seed
npx prisma validate
npm run typecheck
npm run build:api
npm run build
npm audit --omit=dev
git diff --check
```

Manual checks should cover authenticated byte-for-byte download, cross-advisor `403`, unauthenticated
`401`, advisor verification `403`, missing rejection reason `422`, malformed content `422`, EICAR
marker `422`, oversized upload `413`, version increment, re-upload status reset, and final verification.

The frontend remains on simulated uploads until Phase 7. Advisor/staff profile, lender, product,
checklist configuration, and commission management are Phase 5.
