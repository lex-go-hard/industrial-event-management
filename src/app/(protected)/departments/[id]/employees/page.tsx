import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";

export const dynamic = "force-dynamic";

type Search = {
  eventId?: string;
  participant?: string;
  prize?: string;
  fio?: string;
  dob?: string;
};

type Participation = {
  userId: string;
  status: string;
  prizePlace: number | null;
  ratingPoints: number | null;
};

type RosterUser = {
  id: string;
  email: string;
  dateOfBirth: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
};

type RosterEntry = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  dateOfBirth: string | null;
  user: RosterUser | null;
};

type Row = {
  rosterId: string;
  userId: string | null;
  email: string | null;
  fio: string;
  dob: string | null;
  participant: boolean;
  prizePlace: number | null;
  ratingPoints: number | null;
};

export default async function DepartmentEmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const session = await safeAuth();
  if (!session?.user) return null;

  const { id: departmentId } = await params;
  const sp = await searchParams;

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, code: true },
  });
  if (!department) return null;

  const roster = (await prisma.rosterEntry.findMany({
    where: { departmentId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          email: true,
          dateOfBirth: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
    },
  })) as RosterEntry[];

  const eventId = sp.eventId?.trim();
  const participations: Participation[] = eventId
    ? await prisma.eventParticipation.findMany({
        where: { eventId },
        select: { userId: true, status: true, prizePlace: true, ratingPoints: true },
      })
    : [];

  const participationByUserId = new Map(
    participations.map((p: Participation) => [p.userId, p]),
  );

  const fioQuery = (sp.fio ?? "").trim().toLowerCase();
  const dobQuery = (sp.dob ?? "").trim(); // expected YYYY-MM-DD
  const wantParticipant =
    sp.participant === "1" ? true : sp.participant === "0" ? false : null;
  const wantPrize =
    sp.prize === "1" ? true : sp.prize === "0" ? false : null;

  const rows: Row[] = roster
    .map((r: RosterEntry) => {
      const u = r.user;
      const userId = u?.id ?? null;
      const p = userId ? participationByUserId.get(userId) : undefined;
      const fio = `${r.lastName} ${r.firstName} ${r.middleName ?? ""}`.trim();
      return {
        rosterId: r.id,
        userId,
        email: u?.email ?? null,
        fio,
        dob: r.dateOfBirth ?? u?.dateOfBirth ?? null,
        participant: !!p,
        prizePlace: p?.prizePlace ?? null,
        ratingPoints: p?.ratingPoints ?? null,
      };
    })
    .filter((row: Row) => {
      if (wantParticipant !== null && row.participant !== wantParticipant) return false;
      if (wantPrize !== null) {
        const hasPrize = row.prizePlace != null && row.prizePlace > 0;
        if (hasPrize !== wantPrize) return false;
      }
      if (fioQuery) {
        if (!row.fio.toLowerCase().includes(fioQuery)) return false;
      }
      if (dobQuery) {
        if (!row.dob?.startsWith(dobQuery)) return false;
      }
      return true;
    });

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Сотрудники — {department.name} ({department.code})
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Фильтры: участник/призовые/ФИО/дата рождения. Массовое заполнение —
              при выбранном eventId.
            </p>
          </div>
          {eventId ? (
            <div className="flex gap-2">
              <a
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                href={`/api/export/event-participants?eventId=${eventId}&departmentId=${departmentId}`}
              >
                Экспорт рейтинга (Excel)
              </a>
            </div>
          ) : null}
        </div>

        <form className="mt-6 grid gap-3 md:grid-cols-5" method="get">
          <input type="hidden" name="eventId" value={eventId ?? ""} />
          <label className="text-sm font-medium">
            Участник
            <select
              name="participant"
              defaultValue={sp.participant ?? ""}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Все</option>
              <option value="1">Да</option>
              <option value="0">Нет</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Призовые
            <select
              name="prize"
              defaultValue={sp.prize ?? ""}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Все</option>
              <option value="1">Есть</option>
              <option value="0">Нет</option>
            </select>
          </label>
          <label className="text-sm font-medium md:col-span-2">
            ФИО
            <input
              name="fio"
              defaultValue={sp.fio ?? ""}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="поиск содержит..."
            />
          </label>
          <label className="text-sm font-medium">
            Дата рождения
            <input
              name="dob"
              defaultValue={sp.dob ?? ""}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="YYYY-MM-DD"
            />
          </label>
          <div className="md:col-span-5">
            <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Применить
            </button>
          </div>
        </form>

        {eventId ? (
          <div className="mt-6 rounded-xl border border-zinc-200 p-4">
            <div className="font-medium">Массовое заполнение участия</div>
            <p className="mt-1 text-sm text-zinc-600">
              Отметьте участников и призовые места, затем сохраните. (Только
              записи, привязанные к User, попадут в участие.)
            </p>
            <form
              className="mt-3"
              action={`/api/events/${eventId}/participants/bulk`}
              method="post"
              encType="application/json"
            />
          </div>
        ) : null}

        <div className="mt-6 overflow-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr>
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Дата рождения</th>
                <th className="px-4 py-3">Участник</th>
                <th className="px-4 py-3">Приз</th>
                <th className="px-4 py-3">Баллы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rows.map((r: Row) => (
                <tr key={r.rosterId}>
                  <td className="px-4 py-3">{r.fio}</td>
                  <td className="px-4 py-3">{r.dob ?? ""}</td>
                  <td className="px-4 py-3">{r.participant ? "Да" : "Нет"}</td>
                  <td className="px-4 py-3">{r.prizePlace ?? ""}</td>
                  <td className="px-4 py-3">{r.ratingPoints ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-600" colSpan={5}>
                    Нет записей по фильтрам.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
