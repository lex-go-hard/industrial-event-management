-- CreateTable
CREATE TABLE "RegistrationVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationVerification_email_key" ON "RegistrationVerification"("email");

-- CreateIndex
CREATE INDEX "RegistrationVerification_expiresAt_idx" ON "RegistrationVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "RegistrationVerification_lastSentAt_idx" ON "RegistrationVerification"("lastSentAt");
