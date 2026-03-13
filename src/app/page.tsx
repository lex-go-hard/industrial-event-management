import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-amber-200/60 blur-3xl" />
        <div className="absolute top-16 -right-24 h-72 w-72 rounded-full bg-emerald-200/60 blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <p className="inline-flex w-fit items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium">
            Индустриальные мероприятия
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Платформа для планов, событий и отчетов
          </h1>
          <p className="max-w-2xl text-base text-zinc-600">
            Здесь собраны все ключевые разделы: календарь событий, уведомления, планы и
            отчеты. Интерфейс простой и понятный, чтобы быстро находить нужное.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Регистрация
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">События</div>
            <p className="mt-1 text-sm text-zinc-600">
              Создание, перенос, отмена и общий календарь.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">Планы</div>
            <p className="mt-1 text-sm text-zinc-600">
              План на месяц в одном месте, с сохранением и экспортом.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">Отчеты</div>
            <p className="mt-1 text-sm text-zinc-600">
              Данные для школы и быстрый доступ к сводкам.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">Как начать</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              1. Войдите под своим аккаунтом.
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              2. Перейдите в нужный раздел через меню слева.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
