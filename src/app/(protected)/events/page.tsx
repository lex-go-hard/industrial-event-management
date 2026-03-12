import { prisma } from "@/lib/prisma";
import {
import { safeAuth } from "@/lib/auth-safe";
  cancelEventAction,
  createEnterpriseEventAction,
  rescheduleEventAction,
} from "./actions";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  title: string;
  startsAt: Date;
  status: string;
  location: string | null;
};

export default async function EventsPage() {
  const session = await safeAuth();
  if (!session?.user) return null;

  const events: EventRow[] =
    session.user.role === "ADMIN"
      ? await prisma.event.findMany({ orderBy: { startsAt: "asc" } })
      : await prisma.event.findMany({
          where: { departmentId: null },
          orderBy: { startsAt: "asc" },
        });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Мероприятия</h1>
          <div className="flex gap-2">
            <a
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              href={`/api/export/events?year=${year}&month=${month}&format=xlsx`}
            >
              Excel (месяц)
            </a>
            <a
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              href={`/api/export/events?year=${year}&month=${month}&format=docx`}
            >
              Word (месяц)
            </a>
          </div>
        </div>

        <p className="mt-1 text-sm text-zinc-600">
          Сотрудники видят только общие мероприятия предприятия.
        </p>

        {session.user.role === "ADMIN" ? (
          <div className="mt-6 rounded-xl border border-zinc-200 p-4">
            <div className="font-medium">Создать мероприятие предприятия</div>
            <form
              className="mt-3 grid gap-3 md:grid-cols-2"
              action={async (fd) => {
                "use server";
                const title = String(fd.get("title") ?? "").trim();
                const startsAt = String(fd.get("startsAt") ?? "").trim();
                const location = String(fd.get("location") ?? "").trim();
                const description = String(fd.get("description") ?? "").trim();
                if (!title || !startsAt) return;
                await createEnterpriseEventAction({
                  title,
                  startsAt,
                  location: location || undefined,
                  description: description || undefined,
                });
              }}
            >
              <label className="text-sm font-medium">
                Название
                <input
                  name="title"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Дата/время (ISO)
                <input
                  name="startsAt"
                  placeholder="2026-03-12T10:00:00.000Z"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Локация
                <input
                  name="location"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Описание
                <textarea
                  name="description"
                  className="mt-1 h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
                />
              </label>
              <div className="md:col-span-2">
                <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                  Создать
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {events.map((e: EventRow) => (
            <div key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-sm text-zinc-600">
                    {new Date(e.startsAt).toLocaleString()}{" "}
                    {e.status === "CANCELLED" ? "— отменено" : null}
                  </div>
                  {e.location ? (
                    <div className="text-sm text-zinc-600">{e.location}</div>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">{e.status}</div>
                  {session.user.role === "ADMIN" ? (
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {e.status !== "CANCELLED" ? (
                        <form
                          action={async () => {
                            "use server";
                            await cancelEventAction(e.id);
                          }}
                        >
                          <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50">
                            Cancel
                          </button>
                        </form>
                      ) : null}
                      {e.status !== "CANCELLED" ? (
                        <form
                          action={async (fd) => {
                            "use server";
                            const startsAt = String(fd.get("startsAt") ?? "").trim();
                            if (!startsAt) return;
                            await rescheduleEventAction(e.id, startsAt);
                          }}
                          className="flex gap-2"
                        >
                          <input
                            name="startsAt"
                            placeholder="new ISO date"
                            className="w-44 rounded-md border border-zinc-200 px-2 py-1 text-xs"
                          />
                          <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50">
                            Reschedule
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 ? (
            <div className="p-4 text-sm text-zinc-600">Пока нет мероприятий.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
