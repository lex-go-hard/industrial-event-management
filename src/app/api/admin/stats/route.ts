import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { logApiAction } from "@/lib/api/guard";

export async function GET(req: Request) {
  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (session.user.role !== "MAIN_APZ_ADMIN") {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const schools = await prisma.school.findMany({
    select: { id: true, name: true, region: true },
    orderBy: { name: "asc" },
  });

  const schoolStats = await Promise.all(
    schools.map(async (s) => {
      const [classCount, profileClassCount, studentCount] = await Promise.all([
        prisma.schoolClass.count({ where: { schoolId: s.id } }),
        prisma.profileClass.count({ where: { schoolId: s.id } }),
        prisma.student.count({ where: { schoolClass: { schoolId: s.id } } }),
      ]);
      return {
        id: s.id,
        name: s.name,
        region: s.region ?? "Не указан",
        classCount,
        profileClassCount,
        studentCount,
      };
    }),
  );

  const totals = {
    schools: schools.length,
    classes: schoolStats.reduce((sum, s) => sum + s.classCount, 0),
    students: schoolStats.reduce((sum, s) => sum + s.studentCount, 0),
  };

  const regionMap = new Map<string, { region: string; schools: number; students: number }>();
  for (const s of schoolStats) {
    const region = s.region ?? "Не указан";
    const current = regionMap.get(region) ?? { region, schools: 0, students: 0 };
    current.schools += 1;
    current.students += s.studentCount;
    regionMap.set(region, current);
  }
  const regionStats = Array.from(regionMap.values()).sort((a, b) => b.students - a.students);

  const awardAchievements = await prisma.studentAchievement.findMany({
    where: { type: "AWARD" },
    select: {
      student: {
        select: {
          schoolClass: {
            select: {
              id: true,
              name: true,
              school: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const classAwards = new Map<
    string,
    { classId: string; className: string; schoolName: string; awards: number }
  >();
  for (const entry of awardAchievements) {
    const cls = entry.student.schoolClass;
    const key = cls.id;
    const current =
      classAwards.get(key) ??
      { classId: cls.id, className: cls.name, schoolName: cls.school.name, awards: 0 };
    current.awards += 1;
    classAwards.set(key, current);
  }
  const topClasses = Array.from(classAwards.values())
    .sort((a, b) => b.awards - a.awards)
    .slice(0, 10);

  await logApiAction({ req, status: 200, userId: session.user.id });
  return NextResponse.json({
    totals,
    schools: schoolStats,
    regions: regionStats,
    topClasses,
  });
}
