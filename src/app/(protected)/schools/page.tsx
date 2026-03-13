import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SchoolStat = {
  id: string;
  name: string;
  apzCode: string | null;
  classesCount: number;
  studentsCount: number;
};

export default async function SchoolsPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const schoolId = session.user.schoolId ?? null;
  if (role !== "MAIN_APZ_ADMIN" && role !== "ZAVUCH") redirect("/dashboard");
  if (role === "ZAVUCH" && !schoolId) redirect("/dashboard");

  const getSchools = unstable_cache(
    async () => {
      const where = role === "ZAVUCH" ? { id: schoolId! } : {};
      const schools = await prisma.school.findMany({
        where,
        select: {
          id: true,
          name: true,
          apzCode: true,
          _count: { select: { classes: true } },
        },
        orderBy: { name: "asc" },
      });

      const classes = await prisma.schoolClass.findMany({
        where,
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

      return schools.map((s) => ({
        id: s.id,
        name: s.name,
        apzCode: s.apzCode,
        classesCount: s._count.classes,
        studentsCount: studentsBySchool.get(s.id) ?? 0,
      }));
    },
    [`schools:list:${role}:${schoolId ?? "all"}`],
    { revalidate: 120 },
  );

  const schools = await getSchools();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Школы</h1>
          <p className="text-sm text-zinc-600">Выберите школу, чтобы увидеть классы и статистику.</p>
        </header>

        {schools.length === 0 ? (
          <p className="text-sm text-zinc-600">Школы не найдены.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {schools.map((s: SchoolStat) => (
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
