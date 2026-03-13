import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { logApiAction } from "@/lib/api/guard";

export async function GET(
  req: Request,
  context: { params: Promise<{ classId: string }> },
) {
  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (session.user.role !== "MAIN_APZ_ADMIN") {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { classId } = await context.params;

  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      school: { select: { id: true, name: true } },
      classTeacher: { select: { id: true, email: true } },
      profileClass: { select: { id: true, name: true, studentCount: true, formationYear: true } },
    },
  });
  if (!schoolClass) {
    await logApiAction({ req, status: 404, userId: session.user.id });
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const studentCount = await prisma.student.count({
    where: { schoolClassId: classId },
  });

  const awardsCount = await prisma.studentAchievement.count({
    where: {
      type: "AWARD",
      student: { schoolClassId: classId },
    },
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return NextResponse.json({
    class: schoolClass,
    stats: {
      studentCount,
      awardsCount,
    },
  });
}
