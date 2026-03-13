import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ACHIEVEMENT_TYPES = [
  "OLYMPIAD_PARTICIPATION",
  "AWARD",
  "EVENT_PARTICIPATION",
  "RESEARCH_WORK",
  "EXTRA_EDUCATION",
  "FIRST_PROFESSION",
  "OTHER",
] as const;

export default async function StudentCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const { id: studentId } = await params;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      dateOfBirth: true,
      schoolClass: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          schoolId: true,
          classTeacherId: true,
          school: { select: { name: true } },
        },
      },
      achievements: {
        select: { id: true, type: true, eventName: true, date: true, result: true, comment: true },
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });

  if (!student) redirect("/dashboard");

  const role = session.user.role;
  const userSchoolId = session.user.schoolId ?? null;
  const allowed =
    role === "MAIN_APZ_ADMIN" ||
    (role === "ZAVUCH" && userSchoolId === student.schoolClass.schoolId) ||
    (role === "CLASS_TEACHER" && student.schoolClass.classTeacherId === session.user.id);

  if (!allowed) redirect("/dashboard");

  const fio = `${student.lastName} ${student.firstName} ${student.middleName ?? ""}`.trim();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{fio}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Школа: {student.schoolClass.school.name} · Класс: {student.schoolClass.name} ·
            Уровень: {student.schoolClass.gradeLevel ?? "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Дата рождения: {student.dateOfBirth ?? "—"}
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Редактировать ученика</h2>
          <form
            className="mt-3 grid gap-2 md:grid-cols-2"
            action={async (formData) => {
              "use server";
              const lastName = String(formData.get("lastName") ?? "").trim();
              const firstName = String(formData.get("firstName") ?? "").trim();
              const middleName = String(formData.get("middleName") ?? "").trim();
              const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
              if (!lastName || !firstName) return;
              await prisma.student.update({
                where: { id: studentId },
                data: {
                  lastName,
                  firstName,
                  middleName: middleName || null,
                  dateOfBirth: dateOfBirth || null,
                },
              });
              revalidatePath(`/students/${studentId}`);
              redirect(`/students/${studentId}`);
            }}
          >
            <input
              name="lastName"
              defaultValue={student.lastName}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
            />
            <input
              name="firstName"
              defaultValue={student.firstName}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
            />
            <input
              name="middleName"
              defaultValue={student.middleName ?? ""}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
            />
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={student.dateOfBirth ?? ""}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
            />
            <button className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 md:col-span-2">
              Сохранить
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Добавить достижение</h2>
          <form
            className="mt-3 grid gap-2 md:grid-cols-2"
            action={async (formData) => {
              "use server";
              const type = String(formData.get("type") ?? "").trim();
              const eventName = String(formData.get("eventName") ?? "").trim();
              const date = String(formData.get("date") ?? "").trim();
              const result = String(formData.get("result") ?? "").trim();
              const comment = String(formData.get("comment") ?? "").trim();
              if (!type) return;
              await prisma.studentAchievement.create({
                data: {
                  type: type as any,
                  studentId,
                  eventName: eventName || null,
                  date: date ? new Date(date) : null,
                  result: result || null,
                  comment: comment || null,
                },
              });
              revalidatePath(`/students/${studentId}`);
              redirect(`/students/${studentId}`);
            }}
          >
            <select
              name="type"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
              required
            >
              <option value="">Тип достижения</option>
              {ACHIEVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              name="eventName"
              placeholder="Событие"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
            />
            <input
              name="date"
              type="date"
              placeholder="Дата"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
            />
            <input
              name="result"
              placeholder="Результат"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
            />
            <input
              name="comment"
              placeholder="Комментарий"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs md:col-span-2"
            />
            <button className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 md:col-span-2">
              Добавить
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Последние достижения</h2>
          {student.achievements.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Достижений пока нет.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {student.achievements.map((a) => (
                <div key={a.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                  <div className="font-medium">{a.type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-zinc-600">
                    {a.eventName ?? "—"}
                    {a.date ? ` · ${new Date(a.date).toLocaleDateString("ru-RU")}` : ""}
                  </div>
                  {a.result ? <div className="text-xs text-zinc-600">Результат: {a.result}</div> : null}
                  {a.comment ? <div className="text-xs text-zinc-600">Комментарий: {a.comment}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
