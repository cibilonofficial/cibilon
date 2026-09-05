-- Phase 3 extends the controlled application workflow.
ALTER TYPE "ApplicationStatus" ADD VALUE 'DRAFT' BEFORE 'SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'APPLICATION_ASSIGNED' AFTER 'APPLICATION_CREATED';

CREATE TYPE "ApplicationActivityKind" AS ENUM (
    'SUBMISSION',
    'STATUS_CHANGE',
    'ASSIGNMENT',
    'REMARK',
    'CALL',
    'EMAIL',
    'MEETING',
    'NOTE'
);

ALTER TABLE "applications"
    ADD COLUMN "assigned_staff_id" UUID,
    ADD COLUMN "assigned_at" TIMESTAMPTZ(3);

CREATE TABLE "application_assignments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "assigned_by_user_id" UUID NOT NULL,
    "note" TEXT,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMPTZ(3),
    CONSTRAINT "application_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_remarks" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_remarks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_activities" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "kind" "ApplicationActivityKind" NOT NULL,
    "note" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "applications_assigned_staff_id_status_updated_at_idx"
    ON "applications"("assigned_staff_id", "status", "updated_at");
CREATE INDEX "application_assignments_application_id_assigned_at_idx"
    ON "application_assignments"("application_id", "assigned_at");
CREATE INDEX "application_assignments_staff_id_unassigned_at_idx"
    ON "application_assignments"("staff_id", "unassigned_at");
CREATE UNIQUE INDEX "application_assignments_one_active_per_application_idx"
    ON "application_assignments"("application_id") WHERE "unassigned_at" IS NULL;
CREATE INDEX "application_remarks_application_id_created_at_idx"
    ON "application_remarks"("application_id", "created_at");
CREATE INDEX "application_activities_application_id_created_at_idx"
    ON "application_activities"("application_id", "created_at");
CREATE INDEX "application_activities_kind_created_at_idx"
    ON "application_activities"("kind", "created_at");

ALTER TABLE "applications"
    ADD CONSTRAINT "applications_assigned_staff_id_fkey"
    FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "application_assignments"
    ADD CONSTRAINT "application_assignments_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_assignments"
    ADD CONSTRAINT "application_assignments_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_assignments"
    ADD CONSTRAINT "application_assignments_assigned_by_user_id_fkey"
    FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_remarks"
    ADD CONSTRAINT "application_remarks_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_remarks"
    ADD CONSTRAINT "application_remarks_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_activities"
    ADD CONSTRAINT "application_activities_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_activities"
    ADD CONSTRAINT "application_activities_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing Phase 2 applications get the same activity-timeline invariant as new conversions.
INSERT INTO "application_activities" (
    "id", "application_id", "created_by_user_id", "kind", "note", "internal", "metadata", "created_at"
)
SELECT
    gen_random_uuid(),
    a."id",
    a."created_by_user_id",
    'SUBMISSION'::"ApplicationActivityKind",
    'Application submitted',
    false,
    jsonb_build_object('status', a."status"::text, 'applicationNumber', a."application_number"),
    a."submitted_at"
FROM "applications" a
WHERE NOT EXISTS (
    SELECT 1 FROM "application_activities" aa
    WHERE aa."application_id" = a."id" AND aa."kind" = 'SUBMISSION'
);
