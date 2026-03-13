import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { enforceRateLimit, handleCors, json, logApiAction } from "@/lib/api/guard";
import { parseProfileReportDocx } from "@/lib/profile-report";

function roleAllowsImport(params: {
  role: string;
  userId: string;
  userSchoolId?: string | null;
  reportSchoolId: string;
  reportClassTeacherId?: string | null;
}) {
  if (params.role === "MAIN_APZ_ADMIN") return true;
  if (params.role === "ZAVUCH") {
    return !!params.userSchoolId && params.userSchoolId === params.reportSchoolId;
  }
  if (params.role === "CLASS_TEACHER") {
    return !!params.reportClassTeacherId && params.reportClassTeacherId === params.userId;
  }
  return false;
}

export async function POST(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;
  const rl = await enforceRateLimit(req, { points: 20, duration: 60 });
  if (rl) return rl;

  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "NO_FILE" }, { status: 400, req });
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "INVALID_FILE_TYPE" }, { status: 400, req });
  }

  const ab = await file.arrayBuffer();
  let report;
  try {
    report = await parseProfileReportDocx(Buffer.from(ab));
  } catch (error) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json(
      { error: "INVALID_REPORT", message: error instanceof Error ? error.message : "INVALID_REPORT" },
      { status: 400, req },
    );
  }

  const allowed = roleAllowsImport({
    role: session.user.role,
    userId: session.user.id,
    userSchoolId: session.user.schoolId ?? null,
    reportSchoolId: report.schoolId,
    reportClassTeacherId: report.classTeacherId ?? null,
  });

  if (!allowed) {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return json({ error: "FORBIDDEN" }, { status: 403, req });
  }

  const profileClass = await prisma.profileClass.upsert({
    where: { id: report.profileClassId },
    create: {
      id: report.profileClassId,
      name: report.name,
      formationYear: report.formationYear,
      studentCount: report.studentCount,
      gradeLevel: report.gradeLevel ?? null,
      schoolId: report.schoolId,
    },
    update: {
      name: report.name,
      formationYear: report.formationYear,
      studentCount: report.studentCount,
      gradeLevel: report.gradeLevel ?? null,
      schoolId: report.schoolId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: `IMPORT_PROFILE_REPORT role=${session.user.role} rows=1 file=${file.name}`,
      table: "ProfileClass",
      recordId: profileClass.id,
    },
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json(
    {
      ok: true,
      rows: 1,
      profileClassId: profileClass.id,
    },
    { req },
  );
}

export async function OPTIONS(req: Request) {
  return handleCors(req) ?? new NextResponse(null, { status: 204 });
}
