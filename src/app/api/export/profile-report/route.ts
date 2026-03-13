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

function getDistinctTeacherId(classTeacherIds: Array<string | null>) {
  const ids = Array.from(new Set(classTeacherIds.filter(Boolean))) as string[];
  return ids.length === 1 ? ids[0] : null;
}

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const schoolIdsParam = searchParams.get("schoolIds");
  const requestedSchoolIds = schoolIdsParam
    ? schoolIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  let allowedSchoolIds: string[] | null = null;
  if (role === "ZAVUCH") {
    if (!session.user.schoolId) {
      await logApiAction({ req, status: 403, userId: session.user.id });
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    allowedSchoolIds = [session.user.schoolId];
  } else if (role === "MAIN_APZ_ADMIN") {
    allowedSchoolIds = requestedSchoolIds.length ? requestedSchoolIds : null;
  }

  const profileClasses = await prisma.profileClass.findMany({
    where: {
      ...(allowedSchoolIds ? { schoolId: { in: allowedSchoolIds } } : {}),
      ...(role === "CLASS_TEACHER"
        ? { classes: { some: { classTeacherId: session.user.id } } }
        : {}),
    },
    include: {
      classes: {
        select: {
          classTeacherId: true,
        },
      },
    },
    orderBy: [{ schoolId: "asc" }, { formationYear: "desc" }, { name: "asc" }],
  });

  const schoolIds = Array.from(new Set(profileClasses.map((p) => p.schoolId)));
  const schools = await prisma.school.findMany({
    where: { id: { in: schoolIds } },
    select: { id: true, name: true },
  });
  const schoolNamesById = Object.fromEntries(schools.map((s) => [s.id, s.name]));

  const reports: ProfileClassReport[] = profileClasses.map((p) => ({
    profileClassId: p.id,
    name: p.name,
    formationYear: p.formationYear,
    studentCount: p.studentCount,
    gradeLevel: p.gradeLevel ?? null,
    schoolId: p.schoolId,
    classTeacherId: getDistinctTeacherId(p.classes.map((c) => c.classTeacherId)),
  }));

  const schoolName =
    role !== "MAIN_APZ_ADMIN" && session.user.schoolId
      ? schoolNamesById[session.user.schoolId]
      : undefined;

  const buffer = await generateProfileReportDocx({
    reports,
    role,
    schoolName,
    schoolNamesById,
    downloadedBy: session.user.email ?? undefined,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: `EXPORT_PROFILE_REPORT role=${role} rows=${reports.length}`,
      table: "ProfileClass",
      recordId: null,
    },
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": "attachment; filename=\"profile_report.docx\"",
    },
  });
}
