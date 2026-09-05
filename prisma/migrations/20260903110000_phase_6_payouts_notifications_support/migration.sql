-- Phase 6 payouts, per-user notification links, and support tickets.
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "TicketCategory" AS ENUM ('APPLICATION_QUERY', 'DOCUMENT_ISSUE', 'PAYOUT_QUERY', 'ACCOUNT_ACCESS', 'PRODUCT_INFORMATION', 'OTHER');

ALTER TABLE "applications"
    ADD COLUMN "lender_id" UUID,
    ADD COLUMN "disbursed_amount" DECIMAL(15,2),
    ADD COLUMN "disbursed_at" TIMESTAMPTZ(3);

CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "payout_number" VARCHAR(40) NOT NULL,
    "application_id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "commission_rule_id" UUID NOT NULL,
    "commission_version" INTEGER NOT NULL,
    "calculation_type" "CommissionCalculationType" NOT NULL,
    "percentage_rate" DECIMAL(9,6),
    "flat_amount" DECIMAL(15,2),
    "disbursed_amount" DECIMAL(15,2) NOT NULL,
    "payout_amount" DECIMAL(15,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payment_reference" VARCHAR(160),
    "payment_method" VARCHAR(50),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payouts_amounts_check" CHECK ("disbursed_amount" >= 0 AND "payout_amount" >= 0),
    CONSTRAINT "payouts_commission_value_check" CHECK (
      ("calculation_type" = 'PERCENTAGE' AND "percentage_rate" IS NOT NULL AND "flat_amount" IS NULL)
      OR
      ("calculation_type" = 'FLAT' AND "flat_amount" IS NOT NULL AND "percentage_rate" IS NULL)
    ),
    CONSTRAINT "payouts_paid_details_check" CHECK (
      "status" <> 'PAID' OR ("payment_reference" IS NOT NULL AND "paid_at" IS NOT NULL)
    )
);

CREATE TABLE "payout_status_history" (
    "id" UUID NOT NULL,
    "payout_id" UUID NOT NULL,
    "from_status" "PayoutStatus",
    "to_status" "PayoutStatus" NOT NULL,
    "note" TEXT,
    "changed_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payout_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(40) NOT NULL,
    "advisor_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "application_id" UUID,
    "payout_id" UUID,
    "assigned_staff_id" UUID,
    "subject" VARCHAR(200) NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "resolved_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications"
    ADD COLUMN "payout_id" UUID,
    ADD COLUMN "ticket_id" UUID;

CREATE UNIQUE INDEX "payouts_payout_number_key" ON "payouts"("payout_number");
CREATE UNIQUE INDEX "payouts_application_id_key" ON "payouts"("application_id");
CREATE INDEX "payouts_advisor_id_status_created_at_idx" ON "payouts"("advisor_id", "status", "created_at");
CREATE INDEX "payouts_lender_id_status_created_at_idx" ON "payouts"("lender_id", "status", "created_at");
CREATE INDEX "payouts_commission_rule_id_idx" ON "payouts"("commission_rule_id");
CREATE INDEX "payout_status_history_payout_id_created_at_idx" ON "payout_status_history"("payout_id", "created_at");
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");
CREATE INDEX "support_tickets_advisor_id_status_updated_at_idx" ON "support_tickets"("advisor_id", "status", "updated_at");
CREATE INDEX "support_tickets_assigned_staff_id_status_updated_at_idx" ON "support_tickets"("assigned_staff_id", "status", "updated_at");
CREATE INDEX "support_tickets_priority_status_created_at_idx" ON "support_tickets"("priority", "status", "created_at");
CREATE INDEX "support_tickets_application_id_idx" ON "support_tickets"("application_id");
CREATE INDEX "support_tickets_payout_id_idx" ON "support_tickets"("payout_id");
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");
CREATE INDEX "applications_lender_id_status_updated_at_idx" ON "applications"("lender_id", "status", "updated_at");
CREATE INDEX "notifications_payout_id_idx" ON "notifications"("payout_id");
CREATE INDEX "notifications_ticket_id_idx" ON "notifications"("ticket_id");

ALTER TABLE "applications" ADD CONSTRAINT "applications_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_commission_rule_id_fkey" FOREIGN KEY ("commission_rule_id") REFERENCES "commission_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_status_history" ADD CONSTRAINT "payout_status_history_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payout_status_history" ADD CONSTRAINT "payout_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
