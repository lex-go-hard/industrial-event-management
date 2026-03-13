import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type StudentRow = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  dateOfBirth: string | null;
};

export default async function ClassDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const { id: classId } = await params;
  const classInfo = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      schoolId: true,
      classTeacherId: true,
      classTeacher: { select: { id: true, email: true } },
      school: { select: { name: true } },
    },
  });
  if (!classInfo) redirect("/dashboard");

  const role = session.user.role;
  const userSchoolId = session.user.schoolId ?? null;

  const allowed =
    role === "MAIN_APZ_ADMIN" ||
    (role === "ZAVUCH" && userSchoolId === classInfo.schoolId) ||
    (role === "CLASS_TEACHER" && classInfo.classTeacherId === session.user.id);

  if (!allowed) redirect("/dashboard");

  const teachers = await prisma.user.findMany({
    where: { role: "CLASS_TEACHER", schoolId: classInfo.schoolId },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  const students = (await prisma.student.findMany({
    where: { schoolClassId: classId },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      dateOfBirth: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })) as StudentRow[];

  const canManage = role !== "CLASS_TEACHER" || classInfo.classTeacherId === session.user.id;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{classInfo.name}</h1>
          <p className="text-sm text-zinc-600">
            Школа: {classInfo.school.name} · Уровень: {classInfo.gradeLevel ?? "—"}
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Учитель</div>
          <p className="mt-1 text-sm text-zinc-600">
            {classInfo.classTeacher?.email ?? "Не назначен"}
          </p>
          {(role === "MAIN_APZ_ADMIN" || role === "ZAVUCH") ? (
            <form
              className="mt-3 flex items-end gap-2"
              action={async (formData) => {
                "use server";
                const teacherId = String(formData.get("teacherId") ?? "");
                await prisma.schoolClass.update({
                  where: { id: classId },
                  data: { classTeacherId: teacherId || null },
                });
                revalidatePath(`/classes/${classId}`);
                redirect(`/classes/${classId}`);
              }}
            >
              <label className="text-xs font-medium">
                Назначить учителя
                <select
                  name="teacherId"
                  defaultValue={classInfo.classTeacherId ?? ""}
                  className="mt-1 w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">Не назначен</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.email}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800">
                Сохранить
              </button>
            </form>
          ) : null}
        </section>

        {(role === "MAIN_APZ_ADMIN" || role === "ZAVUCH") ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">Редактировать класс</div>
            <form
              className="mt-3 grid gap-2 md:grid-cols-2"
              action={async (formData) => {
                "use server";
                const name = String(formData.get("name") ?? "").trim();
                const gradeLevelRaw = String(formData.get("gradeLevel") ?? "").trim();
                if (!name) return;
                await prisma.schoolClass.update({
                  where: { id: classId },
                  data: {
                    name,
                    gradeLevel: gradeLevelRaw ? Number(gradeLevelRaw) : null,
                  },
                });
                revalidatePath(`/classes/${classId}`);
                redirect(`/classes/${classId}`);
              }}
            >
              <input
                name="name"
                defaultValue={classInfo.name}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
              <input
                name="gradeLevel"
                defaultValue={classInfo.gradeLevel ?? ""}
                placeholder="Уровень"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
              <button className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 md:col-span-2">
                Сохранить
              </button>
            </form>
          </section>
        ) : null}

        {canManage ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">Добавить ученика</div>
            <form
              className="mt-3 grid gap-2 md:grid-cols-4"
              action={async (formData) => {
                "use server";
                const lastName = String(formData.get("lastName") ?? "").trim();
                const firstName = String(formData.get("firstName") ?? "").trim();
                const middleName = String(formData.get("middleName") ?? "").trim();
                const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
                if (!lastName || !firstName) return;
                await prisma.student.create({
                  data: {
                    lastName,
                    firstName,
                    middleName: middleName || null,
                    dateOfBirth: dateOfBirth || null,
                    schoolClassId: classId,
                  },
                });
                revalidatePath(`/classes/${classId}`);
                redirect(`/classes/${classId}`);
              }}
            >
              <input
                name="lastName"
                placeholder="Фамилия"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                required
              />
              <input
                name="firstName"
                placeholder="Имя"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                required
              />
              <input
                name="middleName"
                placeholder="Отчество"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
              <input
                name="dateOfBirth"
                type="date"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
              <button className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 md:col-span-4">
                Добавить
              </button>
            </form>
          </section>
        ) : null}

        {students.length === 0 ? (
          <p className="text-sm text-zinc-600">Учеников нет.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {students.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <Link href={`/students/${s.id}`} className="block hover:underline">
                  <div className="text-sm font-semibold">
                    {s.lastName} {s.firstName} {s.middleName ?? ""}
                  </div>
                </Link>
                <div className="mt-1 text-xs text-zinc-600">
                  Дата рождения: {s.dateOfBirth ?? "—"}
                </div>
                {canManage ? (
                  <form
                    className="mt-2"
                    action={async () => {
                      "use server";
                      await prisma.student.delete({ where: { id: s.id } });
                      revalidatePath(`/classes/${classId}`);
                      redirect(`/classes/${classId}`);
                    }}
                  >
                    <button className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-900 hover:bg-rose-100">
                      Удалить ученика
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
