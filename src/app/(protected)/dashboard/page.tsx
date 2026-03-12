import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventsCalendar } from "@/components/dashboard/calendar";
import { DashboardCharts } from "@/components/dashboard/charts";
import { NotificationsWidget } from "@/components/dashboard/notifications-widget";
import { safeAuth } from "@/lib/auth-safe";

export const dynamic = "force-dynamic";

type ParticipationGroup = { userId: string; _count: { _all: number } };

export default async function DashboardPage() {
  const session = await safeAuth();
  if (!session?.user) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [events, participationByDeptRaw] = await Promise.all([
    prisma.event.findMany({
      where: { startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.eventParticipation.groupBy({
      by: ["userId"],
      where: {
        status: "CONFIRMED",
        event: { startsAt: { gte: start, lt: end } },
      },
      _count: { _all: true },
    }),
  ]);

  // map userId -> department
  const participationByDept = participationByDeptRaw as ParticipationGroup[];
  const userIds = participationByDept.map((p: ParticipationGroup) => p.userId);
  const users = (await prisma.user.findMany({
    where: { id: { in: userIds }, departmentId: { not: null } },
    select: { id: true, departmentId: true },
  })) as Array<{ id: string; departmentId: string | null }>;
  const deptIds = Array.from(
    new Set(
      users
        .map((u: { departmentId: string | null }) => u.departmentId)
        .filter(Boolean) as string[],
    ),
  );
  const departments = (await prisma.department.findMany({
    where: { id: { in: deptIds } },
    select: { id: true, name: true, code: true },
  })) as Array<{ id: string; name: string; code: string }>;

  const deptById = new Map(
    departments.map((d: { id: string; name: string; code: string }) => [
      d.id,
      d,
    ]),
  );
  const confirmedByDept = new Map<string, number>();
  for (const p of participationByDept) {
    const user = users.find((u: { id: string }) => u.id === p.userId);
    if (!user?.departmentId) continue;
    const key = user.departmentId;
    confirmedByDept.set(key, (confirmedByDept.get(key) ?? 0) + p._count._all);
  }

  const participationData = Array.from(confirmedByDept.entries()).map(
    ([deptId, confirmed]) => {
      const dept = deptById.get(deptId);
      return {
        departmentName: dept ? `${dept.name} (${dept.code})` : deptId,
        confirmed,
      };
    },
  );

  const calendarEvents = events.map((e: { id: string; title: string; startsAt: Date }) => ({
    id: e.id,
    title: e.title,
    date: e.startsAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-100 px-6 py-8 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Дашборд мероприятий
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Календарь, статистика участия по цехам и последние напоминания.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/events"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Все мероприятия
            </a>
            <a
              href="/work-plans"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Мой план
            </a>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <EventsCalendar month={month} year={year} events={calendarEvents} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Статистика участия по цехам (текущий месяц)</CardTitle>
              </CardHeader>
              <CardContent>
                <DashboardCharts participationByDept={participationData} />
              </CardContent>
            </Card>
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
                  Раз в квартал руководителям подразделений автоматически
                  отправляются напоминания о необходимости обновить данные.
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
