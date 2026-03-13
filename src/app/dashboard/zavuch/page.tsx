import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getAcademicPeriodLabel(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const academicStartYear = month >= 9 ? year : year - 1;
  const academicEndYear = academicStartYear + 1;
  const quarter =
    month >= 9 && month <= 11
      ? 1
      : month === 12 || month <= 2
        ? 2
        : month >= 3 && month <= 5
          ? 3
          : 4;
  const roman = ["I", "II", "III", "IV"][quarter - 1];
  return {
    label: `${roman} четверть`,
    period: `${academicStartYear}-${academicEndYear}:${quarter}`,
    yearRange: `${academicStartYear}-${academicEndYear}`,
  };
}

export const dynamic = "force-dynamic";

export default async function ZavuchDashboardPage() {
  const session = await safeAuth();
  if (!session?.user) return null;
  if (!session.user.schoolId) return null;

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { id: true, name: true, region: true },
  });

  const classes = await prisma.schoolClass.findMany({
    where: { schoolId: session.user.schoolId },
    include: {
      profileClass: { select: { id: true, name: true } },
      classTeacher: { select: { id: true, email: true } },
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  const period = getAcademicPeriodLabel(new Date());

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-100 px-6 py-8 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Дашборд завуча</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Школа: {school?.name ?? "Не указана"} {school?.region ? `(${school.region})` : ""}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Отчеты по школе</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                href="/api/export/profile-report"
              >
                Сводный отчет по школе
              </a>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Текущий период: {period.label} ({period.yearRange})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Классы школы</CardTitle>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <p className="text-sm text-zinc-600">Классы не найдены.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {classes.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-zinc-500">
                        {c.profileClass?.name ?? "Профиль не указан"}
                        {c.classTeacher?.email ? ` • ${c.classTeacher.email}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                        href={`/api/export/report/${c.id}?period=${period.period}`}
                      >
                        Скачать отчет
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
