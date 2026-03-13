import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type ClassRow = {
  id: string;
  name: string;
  gradeLevel: number | null;
  studentsCount: number;
  teacherId: string | null;
  teacherEmail: string | null;
};

type UserOption = { id: string; email: string; role: string };

export default async function SchoolDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const userSchoolId = session.user.schoolId ?? null;
  if (role !== "MAIN_APZ_ADMIN" && role !== "ZAVUCH") redirect("/dashboard");

  const { id: schoolId } = await params;
  if (role === "ZAVUCH" && userSchoolId !== schoolId) redirect("/dashboard");

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, apzCode: true },
  });
  if (!school) redirect("/schools");

  const zavuch = await prisma.user.findFirst({
    where: { role: "ZAVUCH", schoolId },
    select: { id: true, email: true, isApproved: true },
  });

  const schoolUsers = await prisma.user.findMany({
    where: { schoolId },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });

  const teachers = schoolUsers.filter((u) => u.role === "CLASS_TEACHER");

  const classes = await prisma.schoolClass.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      classTeacherId: true,
      classTeacher: { select: { id: true, email: true } },
      students: { select: { id: true } },
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  const rows: ClassRow[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    gradeLevel: c.gradeLevel,
    studentsCount: c.students.length,
    teacherId: c.classTeacherId,
    teacherEmail: c.classTeacher?.email ?? null,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {school.name}{school.apzCode ? ` (${school.apzCode})` : ""}
          </h1>
          <p className="text-sm text-zinc-600">Выберите класс, чтобы увидеть учеников.</p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Завуч</div>
          <p className="mt-1 text-sm text-zinc-600">
            {zavuch ? zavuch.email : "Не назначен"}
            {zavuch && !zavuch.isApproved ? " (не подтвержден)" : ""}
          </p>
          {role === "MAIN_APZ_ADMIN" ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              action={async (formData) => {
                "use server";
                const userId = String(formData.get("zavuchId") ?? "");
                if (!userId) return;
                await prisma.user.updateMany({
                  where: { role: "ZAVUCH", schoolId },
                  data: { role: "CLASS_TEACHER" },
                });
                await prisma.user.update({
                  where: { id: userId },
                  data: { role: "ZAVUCH", schoolId, isApproved: true },
                });
                revalidatePath(`/schools/${schoolId}`);
                redirect(`/schools/${schoolId}`);
              }}
            >
              <label className="text-xs font-medium">
                Назначить завуча
                <select
                  name="zavuchId"
                  className="mt-1 w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">Выберите пользователя</option>
                  {schoolUsers.map((u: UserOption) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800">
                Назначить
              </button>
            </form>
          ) : null}
        </section>

        {(role === "MAIN_APZ_ADMIN" || role === "ZAVUCH") ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">Добавить класс</div>
            <p className="mt-1 text-xs text-zinc-600">Учитель обязателен.</p>
            <form
              className="mt-3 grid gap-2 md:grid-cols-3"
              action={async (formData) => {
                "use server";
                const name = String(formData.get("name") ?? "").trim();
                const gradeLevelRaw = String(formData.get("gradeLevel") ?? "").trim();
                const teacherId = String(formData.get("teacherId") ?? "").trim();
                if (!name || !teacherId) return;
                await prisma.schoolClass.create({
                  data: {
                    name,
                    gradeLevel: gradeLevelRaw ? Number(gradeLevelRaw) : null,
                    schoolId,
                    classTeacherId: teacherId,
                  },
                });
                revalidatePath(`/schools/${schoolId}`);
                redirect(`/schools/${schoolId}`);
              }}
            >
              <input
                name="name"
                placeholder="Название класса"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                required
              />
              <input
                name="gradeLevel"
                placeholder="Уровень (например 8)"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
              <select
                name="teacherId"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                required
              >
                <option value="">Учитель</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.email}
                  </option>
                ))}
              </select>
              <button className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 md:col-span-3">
                Добавить
              </button>
            </form>
          </section>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600">Классы не найдены.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <Link href={`/classes/${c.id}`} className="block hover:underline">
                  <div className="text-sm font-semibold">{c.name}</div>
                </Link>
                <div className="mt-1 text-xs text-zinc-600">
                  Уровень: {c.gradeLevel ?? "—"} · Ученики: {c.studentsCount}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Учитель: {c.teacherEmail ?? "Не назначен"}
                </div>
                {(role === "MAIN_APZ_ADMIN" || role === "ZAVUCH") ? (
                  <form
                    className="mt-2 flex items-center gap-2"
                    action={async (formData) => {
                      "use server";
                      const teacherId = String(formData.get("teacherId") ?? "");
                      await prisma.schoolClass.update({
                        where: { id: c.id },
                        data: { classTeacherId: teacherId || null },
                      });
                      revalidatePath(`/schools/${schoolId}`);
                      redirect(`/schools/${schoolId}`);
                    }}
                  >
                    <select
                      name="teacherId"
                      defaultValue={c.teacherId ?? ""}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">Не назначен</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.email}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-lg bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800">
                      Сохранить
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}