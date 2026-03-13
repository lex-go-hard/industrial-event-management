import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { logApiAction } from "@/lib/api/guard";
import { generateProfileReportDocx } from "@/lib/profile-report";
import type { AppRole, ProfileClassReport } from "@/types";

function toAppRole(role?: string | null): AppRole | null {
  if (role === "MAIN_APZ_ADMIN" || role === "ZAVUCH" || role === "CLASS_TEACHER") return role;
  return null;
}

function parsePeriod(period?: string | null) {
  if (!period) return null;
  const text = period.trim();
  const match =
    text.match(/(\d{4}\s*-\s*\d{4}).*?(?:q|кв|четверть)?\s*(\d)/i) ??
    text.match(/(\d{4}\s*-\s*\d{4})\s*[:_]\s*(\d)/i);
  if (!match) return null;
  const yearRange = match[1].replace(/\s+/g, "");
  const quarter = Number(match[2]);
  if (quarter < 1 || quarter > 4) return null;
  const roman = ["I", "II", "III", "IV"][quarter - 1];
  return { yearRange, quarter, roman };
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

export async function GET(
  req: Request,
  context: { params: Promise<{ classId: string }> },
) {
  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const role = toAppRole(session.user.role);
  if (!role) {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { classId } = await context.params;
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  const parsedPeriod = parsePeriod(period);
  if (!parsedPeriod) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return NextResponse.json({ error: "INVALID_PERIOD" }, { status: 400 });
  }

  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id: classId },
    include: {
      school: { select: { id: true, name: true } },
      profileClass: true,
    },
  });
  if (!schoolClass || !schoolClass.profileClass) {
    await logApiAction({ req, status: 404, userId: session.user.id });
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Middleware-style role checks
  if (role === "CLASS_TEACHER" && schoolClass.classTeacherId !== session.user.id) {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (role === "ZAVUCH" && schoolClass.schoolId !== session.user.schoolId) {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const report: ProfileClassReport = {
    profileClassId: schoolClass.profileClass.id,
    name: schoolClass.profileClass.name,
    formationYear: schoolClass.profileClass.formationYear,
    studentCount: schoolClass.profileClass.studentCount,
    gradeLevel: schoolClass.profileClass.gradeLevel ?? null,
    schoolId: schoolClass.schoolId,
    classTeacherId: schoolClass.classTeacherId ?? null,
  };

  const buffer = await generateProfileReportDocx({
    reports: [report],
    role,
    schoolName: schoolClass.school?.name,
    schoolNamesById: schoolClass.school?.id
      ? { [schoolClass.school.id]: schoolClass.school.name }
      : undefined,
    downloadedBy: session.user.email ?? undefined,
  });

  const fileName = sanitizeFilename(
    `Отчет_${schoolClass.name}_${parsedPeriod.roman}_четверть_${parsedPeriod.yearRange}_${schoolClass.school?.name ?? "Школа"}.docx`,
  );

  await logApiAction({ req, status: 200, userId: session.user.id });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
