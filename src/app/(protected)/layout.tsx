import Link from "next/link";
import { redirect } from "next/navigation";
import { safeAuth } from "@/lib/auth-safe";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-6">
        <aside className="w-64 shrink-0">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">Навигация</div>
            <div className="mt-3 flex flex-col gap-1">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
              >
                Дашборд
              </Link>
              <Link
                href="/events"
                className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
              >
                Мероприятия
              </Link>
              <Link
                href="/work-plans"
                className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
              >
                Мой план
              </Link>
            </div>

            {role === "MAIN_APZ_ADMIN" || role === "ZAVUCH" ? (
              <div className="mt-5">
                <div className="text-xs font-semibold uppercase text-zinc-500">
                  Школы
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <Link
                    href="/schools"
                    className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Список школ
                  </Link>
                </div>
              </div>
            ) : null}

            {role === "MAIN_APZ_ADMIN" ? (
              <div className="mt-5">
                <div className="text-xs font-semibold uppercase text-zinc-500">
                  Админ
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <Link
                    href="/admin/users"
                    className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Пользователи
                  </Link>
                  <Link
                    href="/admin/users/import"
                    className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Импорт пользователей
                  </Link>
                  <Link
                    href="/admin/export"
                    className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Экспорт данных
                  </Link>
                  <Link
                    href="/admin/api-docs"
                    className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Документация API
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

