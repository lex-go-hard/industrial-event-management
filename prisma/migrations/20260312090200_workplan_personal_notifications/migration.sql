-- WorkPlan: convert to personal plan (ownerId) and add Notification model.

-- 1) NotificationType enum + Notification table
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'EVENT_CREATED',
    'EVENT_CANCELLED',
    'EVENT_RESCHEDULED',
    'WORKPLAN_CREATED',
    'WORKPLAN_UPDATED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "data" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx"
  ON "Notification" ("userId", "readAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"
  ON "Notification" ("createdAt");

-- 2) WorkPlan: add ownerId and migrate data from createdById (dev-safe)
ALTER TABLE "WorkPlan" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

UPDATE "WorkPlan"
SET "ownerId" = COALESCE("ownerId", "createdById")
WHERE "ownerId" IS NULL;

-- If there are existing WorkPlans without createdById, this will fail; that's desirable for consistency.
ALTER TABLE "WorkPlan" ALTER COLUMN "ownerId" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "WorkPlan"
    ADD CONSTRAINT "WorkPlan_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Drop old unique/indexes
DROP INDEX IF EXISTS "WorkPlan_departmentId_year_month_key";
DROP INDEX IF EXISTS "WorkPlan_createdById_idx";

-- Remove old column
ALTER TABLE "WorkPlan" DROP COLUMN IF EXISTS "createdById";

-- New uniqueness and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "WorkPlan_ownerId_year_month_key"
  ON "WorkPlan" ("ownerId", "year", "month");

CREATE INDEX IF NOT EXISTS "WorkPlan_departmentId_year_month_idx"
  ON "WorkPlan" ("departmentId", "year", "month");

