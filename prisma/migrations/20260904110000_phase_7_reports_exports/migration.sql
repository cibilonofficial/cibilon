-- Phase 7 asynchronous report export jobs.
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_ACTION';
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'PDF');
CREATE TYPE "ReportType" AS ENUM ('APPLICATIONS', 'ADVISORS', 'PAYOUTS', 'LENDERS');

CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "filters" JSONB,
    "file_name" VARCHAR(255),
    "file_path" VARCHAR(1000),
    "mime_type" VARCHAR(100),
    "row_count" INTEGER,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "export_jobs_requested_by_user_id_status_created_at_idx" ON "export_jobs"("requested_by_user_id", "status", "created_at");
CREATE INDEX "export_jobs_status_created_at_idx" ON "export_jobs"("status", "created_at");
CREATE INDEX "export_jobs_expires_at_idx" ON "export_jobs"("expires_at");

ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
