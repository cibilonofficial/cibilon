-- Phase 4 document storage, verification, and immutable version history.
CREATE TYPE "MalwareScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');
ALTER TYPE "ApplicationActivityKind" ADD VALUE 'DOCUMENT';

ALTER TABLE "document_requests"
    ADD COLUMN "rejection_reason" TEXT,
    ADD COLUMN "reviewed_by_user_id" UUID,
    ADD COLUMN "reviewed_at" TIMESTAMPTZ(3);

CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "document_request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "malware_scan_status" "MalwareScanStatus" NOT NULL DEFAULT 'PENDING',
    "malware_scan_details" JSONB,
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documents_document_request_id_key" ON "documents"("document_request_id");
CREATE INDEX "documents_application_id_created_at_idx" ON "documents"("application_id", "created_at");
CREATE UNIQUE INDEX "document_versions_storage_key_key" ON "document_versions"("storage_key");
CREATE UNIQUE INDEX "document_versions_document_id_version_key" ON "document_versions"("document_id", "version");
CREATE INDEX "document_versions_document_id_uploaded_at_idx" ON "document_versions"("document_id", "uploaded_at");
CREATE INDEX "document_versions_malware_scan_status_uploaded_at_idx" ON "document_versions"("malware_scan_status", "uploaded_at");

ALTER TABLE "document_requests"
    ADD CONSTRAINT "document_requests_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents"
    ADD CONSTRAINT "documents_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents"
    ADD CONSTRAINT "documents_document_request_id_fkey"
    FOREIGN KEY ("document_request_id") REFERENCES "document_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions"
    ADD CONSTRAINT "document_versions_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions"
    ADD CONSTRAINT "document_versions_uploaded_by_user_id_fkey"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
