import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { logApiAction } from "@/lib/api/guard";

export async function GET(
  req: Request,
  context: { params: Promise<{ schoolId: string }> },
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

  const { schoolId } = await context.params;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, region: true },
  });
  if (!school) {
    await logApiAction({ req, status: 404, userId: session.user.id });
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const classes = await prisma.schoolClass.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      classTeacher: { select: { id: true, email: true } },
      profileClass: { select: { id: true, name: true } },
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  const classIds = classes.map((c) => c.id);
  const studentCounts = await prisma.student.groupBy({
    by: ["schoolClassId"],
    where: { schoolClassId: { in: classIds } },
    _count: { _all: true },
  });
  const countMap = new Map(studentCounts.map((c) => [c.schoolClassId, c._count._all]));

  await logApiAction({ req, status: 200, userId: session.user.id });
  return NextResponse.json({
    school,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      classTeacher: c.classTeacher,
      profileClass: c.profileClass,
      students: countMap.get(c.id) ?? 0,
    })),
  });
}
