-- Phase 2 enums
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "LeadStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CONVERTED', 'ARCHIVED');
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DOCUMENTS_PENDING', 'CONVERTED', 'DROPPED');
CREATE TYPE "LeadActivityKind" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'NOTE', 'STAGE_CHANGE', 'FOLLOW_UP', 'CONVERSION');
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING', 'SENT_TO_LENDER', 'LENDER_PROCESSING', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED');
CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_CREATED', 'LEAD_ASSIGNED', 'FOLLOW_UP_DUE', 'STATUS_CHANGED', 'DOCUMENT_ACTION', 'PAYOUT_ACTION', 'SUPPORT_ACTION', 'SECURITY');
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED');

-- Customers keep high-risk identifiers encrypted and expose only last-four masks.
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "full_name" VARCHAR(160),
    "mobile" VARCHAR(20),
    "email" VARCHAR(320),
    "date_of_birth" DATE,
    "gender" "Gender",
    "pan_encrypted" TEXT,
    "pan_last_four" CHAR(4),
    "aadhaar_encrypted" TEXT,
    "aadhaar_last_four" CHAR(4),
    "address_line" VARCHAR(500),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" CHAR(6),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "customer_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'DRAFT',
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "service_type" VARCHAR(80),
    "requested_amount" DECIMAL(15,2),
    "employment_data" JSONB,
    "bank_account_encrypted" TEXT,
    "bank_account_last_four" CHAR(4),
    "service_data" JSONB,
    "source" VARCHAR(100),
    "notes" TEXT,
    "next_follow_up_at" TIMESTAMPTZ(3),
    "converted_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "kind" "LeadActivityKind" NOT NULL,
    "note" TEXT NOT NULL,
    "due_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_counters" (
    "period" CHAR(6) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "application_counters_pkey" PRIMARY KEY ("period")
);

CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "application_number" VARCHAR(30) NOT NULL,
    "lead_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "service_type" VARCHAR(80) NOT NULL,
    "requested_amount" DECIMAL(15,2),
    "customer_snapshot" JSONB NOT NULL,
    "employment_snapshot" JSONB,
    "service_snapshot" JSONB,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "remarks" TEXT,
    "changed_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "lead_id" UUID,
    "application_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_requests" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "document_type" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_user_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_advisor_id_mobile_key" ON "customers"("advisor_id", "mobile");
CREATE INDEX "customers_advisor_id_created_at_idx" ON "customers"("advisor_id", "created_at");
CREATE INDEX "customers_full_name_idx" ON "customers"("full_name");
CREATE INDEX "leads_advisor_id_status_created_at_idx" ON "leads"("advisor_id", "status", "created_at");
CREATE INDEX "leads_customer_id_idx" ON "leads"("customer_id");
CREATE INDEX "leads_stage_created_at_idx" ON "leads"("stage", "created_at");
CREATE INDEX "leads_service_type_created_at_idx" ON "leads"("service_type", "created_at");
CREATE INDEX "leads_next_follow_up_at_idx" ON "leads"("next_follow_up_at");
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");
CREATE INDEX "lead_activities_kind_due_at_idx" ON "lead_activities"("kind", "due_at");
CREATE UNIQUE INDEX "applications_application_number_key" ON "applications"("application_number");
CREATE UNIQUE INDEX "applications_lead_id_key" ON "applications"("lead_id");
CREATE INDEX "applications_advisor_id_status_created_at_idx" ON "applications"("advisor_id", "status", "created_at");
CREATE INDEX "applications_customer_id_idx" ON "applications"("customer_id");
CREATE INDEX "application_status_history_application_id_created_at_idx" ON "application_status_history"("application_id", "created_at");
CREATE INDEX "notifications_recipient_user_id_is_read_created_at_idx" ON "notifications"("recipient_user_id", "is_read", "created_at");
CREATE INDEX "notifications_application_id_idx" ON "notifications"("application_id");
CREATE UNIQUE INDEX "document_requests_application_id_document_type_key" ON "document_requests"("application_id", "document_type");
CREATE INDEX "document_requests_application_id_status_idx" ON "document_requests"("application_id", "status");

ALTER TABLE "customers" ADD CONSTRAINT "customers_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
