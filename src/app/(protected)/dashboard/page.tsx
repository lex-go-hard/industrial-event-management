import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventsCalendar } from "@/components/dashboard/calendar";
import { NotificationsWidget } from "@/components/dashboard/notifications-widget";
import { safeAuth } from "@/lib/auth-safe";

export const dynamic = "force-dynamic";

type ParticipationGroup = { userId: string; _count: { _all: number } };

type SchoolStat = {
  id: string;
  name: string;
  apzCode: string | null;
  classesCount: number;
  studentsCount: number;
  activityCount: number;
};

type ClassSummary = {
  id: string;
  name: string;
  gradeLevel: number | null;
  schoolName: string;
  studentsCount: number;
};

export default async function DashboardPage() {
  const session = await safeAuth();
  if (!session?.user) return null;

  const role = session.user.role;
  const schoolId = session.user.schoolId ?? null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const getCalendarEvents = unstable_cache(
    async () => {
      return prisma.event.findMany({
        where: { startsAt: { gte: start, lt: end } },
        orderBy: { startsAt: "asc" },
      });
    },
    [`dashboard:calendar:${year}-${month}`],
    { revalidate: 60 },
  );

  const calendarEvents = (await getCalendarEvents()).map(
    (e: { id: string; title: string; startsAt: Date | string }) => ({
      id: e.id,
      title: e.title,
      date: new Date(e.startsAt).toISOString(),
    }),
  );

  let schoolStats: SchoolStat[] = [];
  let teacherClasses: ClassSummary[] = [];

  if (role === "MAIN_APZ_ADMIN" || role === "ZAVUCH") {
    const filterSchoolId = role === "ZAVUCH" ? schoolId : null;

    const getSchoolStats = unstable_cache(
      async () => {
        const schoolWhere = filterSchoolId ? { id: filterSchoolId } : {};
        const schools = await prisma.school.findMany({
          where: schoolWhere,
          select: {
            id: true,
            name: true,
            apzCode: true,
            _count: { select: { classes: true } },
          },
          orderBy: { name: "asc" },
        });

        const classes = await prisma.schoolClass.findMany({
          where: schoolWhere,
          select: { id: true, schoolId: true },
        });
        const classById = new Map(classes.map((c) => [c.id, c.schoolId]));

        const studentsByClass = await prisma.student.groupBy({
          by: ["schoolClassId"],
          _count: { _all: true },
        });
        const studentsBySchool = new Map<string, number>();
        for (const row of studentsByClass) {
          const sid = classById.get(row.schoolClassId);
          if (!sid) continue;
          studentsBySchool.set(sid, (studentsBySchool.get(sid) ?? 0) + row._count._all);
        }

        const participationByUser = (await prisma.eventParticipation.groupBy({
          by: ["userId"],
          where: {
            status: "CONFIRMED",
            event: { startsAt: { gte: start, lt: end } },
          },
          _count: { _all: true },
        })) as ParticipationGroup[];

        const userIds = participationByUser.map((p) => p.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds }, schoolId: { not: null } },
          select: { id: true, schoolId: true },
        });

        const activityBySchool = new Map<string, number>();
        for (const p of participationByUser) {
          const user = users.find((u) => u.id === p.userId);
          if (!user?.schoolId) continue;
          activityBySchool.set(
            user.schoolId,
            (activityBySchool.get(user.schoolId) ?? 0) + p._count._all,
          );
        }

        return schools.map((s) => ({
          id: s.id,
          name: s.name,
          apzCode: s.apzCode,
          classesCount: s._count.classes,
          studentsCount: studentsBySchool.get(s.id) ?? 0,
          activityCount: activityBySchool.get(s.id) ?? 0,
        }));
      },
      [`dashboard:schools:${filterSchoolId ?? "all"}:${year}-${month}`],
      { revalidate: 60 },
    );

    schoolStats = await getSchoolStats();
  }

  if (role === "CLASS_TEACHER") {
    const getTeacherClasses = unstable_cache(
      async () => {
        const classes = await prisma.schoolClass.findMany({
          where: { classTeacherId: session.user.id },
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            school: { select: { name: true } },
            students: { select: { id: true } },
          },
          orderBy: { name: "asc" },
        });
        return classes.map((c) => ({
          id: c.id,
          name: c.name,
          gradeLevel: c.gradeLevel,
          schoolName: c.school.name,
          studentsCount: c.students.length,
        }));
      },
      [`dashboard:teacher:${session.user.id}`],
      { revalidate: 60 },
    );

    teacherClasses = await getTeacherClasses();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-100 px-6 py-8 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Дашборд</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Календарь, статистика и быстрые переходы по разделам.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Мероприятия
            </Link>
            <Link
              href="/work-plans"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Мой план
            </Link>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <EventsCalendar month={month} year={year} events={calendarEvents} />
              </CardContent>
            </Card>

            {role === "MAIN_APZ_ADMIN" || role === "ZAVUCH" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Активность школ</CardTitle>
                </CardHeader>
                <CardContent>
                  {schoolStats.length === 0 ? (
                    <p className="text-sm text-zinc-600">Школы не найдены.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {schoolStats.map((s) => (
                        <Link
                          key={s.id}
                          href={`/schools/${s.id}`}
                          className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
                        >
                          <div className="text-sm font-semibold">
                            {s.name}
                            {s.apzCode ? ` (${s.apzCode})` : ""}
                          </div>
                          <div className="mt-2 text-xs text-zinc-600">
                            Классы: {s.classesCount} · Ученики: {s.studentsCount}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            Активность за месяц: {s.activityCount}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {role === "CLASS_TEACHER" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Мой класс</CardTitle>
                </CardHeader>
                <CardContent>
                  {teacherClasses.length === 0 ? (
                    <p className="text-sm text-zinc-600">Класс не привязан.</p>
                  ) : (
                    <div className="grid gap-3">
                      {teacherClasses.map((c) => (
                        <Link
                          key={c.id}
                          href={`/classes/${c.id}`}
                          className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
                        >
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="mt-1 text-xs text-zinc-600">
                            Школа: {c.schoolName}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            Ученики: {c.studentsCount}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Напоминания и уведомления</CardTitle>
              </CardHeader>
              <CardContent>
                <NotificationsWidget />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Квартальные напоминания</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600">
                  Раз в квартал руководителям школ приходят напоминания обновить данные.
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  API cron: POST /api/cron/quarterly-reminder (x-cron-secret)
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
