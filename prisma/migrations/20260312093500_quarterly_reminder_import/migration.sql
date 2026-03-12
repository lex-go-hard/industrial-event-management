-- Extend NotificationType enum
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUARTERLY_REMINDER';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- QuarterlyReminderImport table
CREATE TABLE IF NOT EXISTS "QuarterlyReminderImport" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "quarter" INTEGER NOT NULL,
  "contentJson" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuarterlyReminderImport_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "QuarterlyReminderImport"
    ADD CONSTRAINT "QuarterlyReminderImport_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "QuarterlyReminderImport_departmentId_year_quarter_key"
  ON "QuarterlyReminderImport" ("departmentId", "year", "quarter");

CREATE INDEX IF NOT EXISTS "QuarterlyReminderImport_year_quarter_idx"
  ON "QuarterlyReminderImport" ("year", "quarter");

