-- CreateEnum
CREATE TYPE "StudentAchievementType" AS ENUM ('OLYMPIAD_PARTICIPATION', 'AWARD', 'EVENT_PARTICIPATION', 'RESEARCH_WORK', 'EXTRA_EDUCATION', 'FIRST_PROFESSION', 'OTHER');

-- CreateEnum
CREATE TYPE "AdditionalEventLevel" AS ENUM ('MUNICIPAL', 'REGIONAL', 'INTERREGIONAL', 'ALL_RUSSIAN');

-- CreateEnum
CREATE TYPE "AdditionalEventFormat" AS ENUM ('OFFLINE', 'ONLINE', 'HYBRID');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" INTEGER,
    "schoolId" TEXT NOT NULL,
    "classTeacherId" TEXT,
    "profileClassId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "dateOfBirth" TEXT,
    "schoolClassId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formationYear" INTEGER NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "gradeLevel" INTEGER,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" TEXT NOT NULL,
    "type" "StudentAchievementType" NOT NULL,
    "studentId" TEXT NOT NULL,
    "eventName" TEXT,
    "date" TIMESTAMP(3),
    "result" TEXT,
    "place" TEXT,
    "organizer" TEXT,
    "documentUrl" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNIR" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publicationInfo" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "conferenceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentNIR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraEducationProgram" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraEducationProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirstProfession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eduOrg" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirstProfession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "level" "AdditionalEventLevel" NOT NULL,
    "format" "AdditionalEventFormat" NOT NULL,
    "participantsCount" INTEGER NOT NULL,
    "targetClasses" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdditionalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "School_name_idx" ON "School"("name");

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_gradeLevel_idx" ON "SchoolClass"("schoolId", "gradeLevel");

-- CreateIndex
CREATE INDEX "SchoolClass_classTeacherId_idx" ON "SchoolClass"("classTeacherId");

-- CreateIndex
CREATE INDEX "SchoolClass_profileClassId_idx" ON "SchoolClass"("profileClassId");

-- CreateIndex
CREATE INDEX "Student_schoolClassId_idx" ON "Student"("schoolClassId");

-- CreateIndex
CREATE INDEX "Student_lastName_firstName_idx" ON "Student"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "ProfileClass_schoolId_idx" ON "ProfileClass"("schoolId");

-- CreateIndex
CREATE INDEX "ProfileClass_formationYear_idx" ON "ProfileClass"("formationYear");

-- CreateIndex
CREATE INDEX "StudentAchievement_studentId_type_idx" ON "StudentAchievement"("studentId", "type");

-- CreateIndex
CREATE INDEX "StudentAchievement_date_idx" ON "StudentAchievement"("date");

-- CreateIndex
CREATE INDEX "StudentNIR_studentId_idx" ON "StudentNIR"("studentId");

-- CreateIndex
CREATE INDEX "StudentNIR_date_idx" ON "StudentNIR"("date");

-- CreateIndex
CREATE INDEX "ExtraEducationProgram_studentId_idx" ON "ExtraEducationProgram"("studentId");

-- CreateIndex
CREATE INDEX "ExtraEducationProgram_periodStart_periodEnd_idx" ON "ExtraEducationProgram"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "FirstProfession_studentId_idx" ON "FirstProfession"("studentId");

-- CreateIndex
CREATE INDEX "FirstProfession_periodStart_periodEnd_idx" ON "FirstProfession"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AdditionalEvent_date_idx" ON "AdditionalEvent"("date");

-- CreateIndex
CREATE INDEX "AdditionalEvent_level_idx" ON "AdditionalEvent"("level");

-- CreateIndex
CREATE INDEX "AdditionalEvent_format_idx" ON "AdditionalEvent"("format");

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_profileClassId_fkey" FOREIGN KEY ("profileClassId") REFERENCES "ProfileClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClass" ADD CONSTRAINT "ProfileClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNIR" ADD CONSTRAINT "StudentNIR_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraEducationProgram" ADD CONSTRAINT "ExtraEducationProgram_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirstProfession" ADD CONSTRAINT "FirstProfession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
