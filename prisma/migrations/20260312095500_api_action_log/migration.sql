CREATE TABLE IF NOT EXISTS "ApiActionLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" INTEGER NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiActionLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ApiActionLog"
    ADD CONSTRAINT "ApiActionLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ApiActionLog_createdAt_idx" ON "ApiActionLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "ApiActionLog_userId_createdAt_idx" ON "ApiActionLog" ("userId","createdAt");
CREATE INDEX IF NOT EXISTS "ApiActionLog_path_createdAt_idx" ON "ApiActionLog" ("path","createdAt");

