-- Phase 5 advisor/staff management, product catalogue, lenders, and versioned commissions.
CREATE TYPE "AdvisorBankStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');
CREATE TYPE "StaffRole" AS ENUM ('OPERATIONS_MANAGER', 'CREDIT_ANALYST', 'VERIFICATION_OFFICER', 'PAYOUT_EXECUTIVE', 'RELATIONSHIP_MANAGER');
CREATE TYPE "LenderType" AS ENUM ('BANK', 'NBFC', 'HFC', 'FINTECH', 'INSURER');
CREATE TYPE "LenderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'INACTIVE');
CREATE TYPE "CommissionCalculationType" AS ENUM ('PERCENTAGE', 'FLAT');

ALTER TABLE "advisors"
    ADD COLUMN "gstin" VARCHAR(15),
    ADD COLUMN "pan_encrypted" TEXT,
    ADD COLUMN "pan_last_four" CHAR(4),
    ADD COLUMN "address_line" VARCHAR(500),
    ADD COLUMN "city" VARCHAR(100),
    ADD COLUMN "state" VARCHAR(100),
    ADD COLUMN "pincode" CHAR(6),
    ADD COLUMN "photo_url" VARCHAR(1000);

ALTER TABLE "staff"
    ADD COLUMN "role" "StaffRole" NOT NULL DEFAULT 'CREDIT_ANALYST';

CREATE TABLE "user_permissions" (
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id", "permission_id")
);

CREATE TABLE "advisor_bank_accounts" (
    "id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "account_holder" VARCHAR(160) NOT NULL,
    "bank_name" VARCHAR(160) NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_number_last_four" CHAR(4) NOT NULL,
    "ifsc" CHAR(11) NOT NULL,
    "status" "AdvisorBankStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "rejection_reason" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "advisor_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lenders" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "LenderType" NOT NULL,
    "status" "LenderStatus" NOT NULL DEFAULT 'ACTIVE',
    "turnaround_days" INTEGER NOT NULL DEFAULT 7,
    "contact_person" VARCHAR(160),
    "email" VARCHAR(320),
    "phone" VARCHAR(20),
    "city" VARCHAR(100),
    "notes" TEXT,
    "empanelled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "service_type" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tagline" VARCHAR(500),
    "min_amount" DECIMAL(15,2),
    "max_amount" DECIMAL(15,2),
    "min_tenure_months" INTEGER,
    "max_tenure_months" INTEGER,
    "interest_from" DECIMAL(7,4),
    "interest_to" DECIMAL(7,4),
    "turnaround_days" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_lenders" (
    "product_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "turnaround_days" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "product_lenders_pkey" PRIMARY KEY ("product_id", "lender_id")
);

CREATE TABLE "product_eligibility" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "rule" VARCHAR(500) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_eligibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_documents" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "document_type" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "lender_id" UUID,
    "version" INTEGER NOT NULL,
    "calculation_type" "CommissionCalculationType" NOT NULL,
    "percentage_rate" DECIMAL(9,6),
    "flat_amount" DECIMAL(15,2),
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commission_rules_value_check" CHECK (
      ("calculation_type" = 'PERCENTAGE' AND "percentage_rate" IS NOT NULL AND "flat_amount" IS NULL)
      OR
      ("calculation_type" = 'FLAT' AND "flat_amount" IS NOT NULL AND "percentage_rate" IS NULL)
    ),
    CONSTRAINT "commission_rules_effective_range_check" CHECK (
      "effective_to" IS NULL OR "effective_to" > "effective_from"
    )
);

CREATE UNIQUE INDEX "advisor_bank_accounts_advisor_id_key" ON "advisor_bank_accounts"("advisor_id");
CREATE INDEX "advisor_bank_accounts_status_updated_at_idx" ON "advisor_bank_accounts"("status", "updated_at");
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions"("permission_id");
CREATE UNIQUE INDEX "lenders_name_key" ON "lenders"("name");
CREATE INDEX "lenders_status_type_created_at_idx" ON "lenders"("status", "type", "created_at");
CREATE INDEX "lenders_city_idx" ON "lenders"("city");
CREATE UNIQUE INDEX "products_service_type_key" ON "products"("service_type");
CREATE INDEX "products_active_updated_at_idx" ON "products"("active", "updated_at");
CREATE INDEX "product_lenders_lender_id_active_idx" ON "product_lenders"("lender_id", "active");
CREATE UNIQUE INDEX "product_eligibility_product_id_rule_key" ON "product_eligibility"("product_id", "rule");
CREATE INDEX "product_eligibility_product_id_sort_order_idx" ON "product_eligibility"("product_id", "sort_order");
CREATE UNIQUE INDEX "product_documents_product_id_document_type_key" ON "product_documents"("product_id", "document_type");
CREATE INDEX "product_documents_product_id_sort_order_idx" ON "product_documents"("product_id", "sort_order");
CREATE INDEX "commission_rules_product_id_lender_id_active_effective_from_idx" ON "commission_rules"("product_id", "lender_id", "active", "effective_from");
CREATE UNIQUE INDEX "commission_rules_default_version_key" ON "commission_rules"("product_id", "version") WHERE "lender_id" IS NULL;
CREATE UNIQUE INDEX "commission_rules_lender_version_key" ON "commission_rules"("product_id", "lender_id", "version") WHERE "lender_id" IS NOT NULL;

ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advisor_bank_accounts" ADD CONSTRAINT "advisor_bank_accounts_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advisor_bank_accounts" ADD CONSTRAINT "advisor_bank_accounts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_lenders" ADD CONSTRAINT "product_lenders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_lenders" ADD CONSTRAINT "product_lenders_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_eligibility" ADD CONSTRAINT "product_eligibility_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
