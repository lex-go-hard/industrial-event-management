import { Suspense } from "react";

import { prisma } from "@/lib/prisma";
import { AuthSwitcher } from "@/components/auth/auth-switcher";

export async function AuthPage({
  initialMode,
  message,
}: {
  initialMode?: "signin" | "signup";
  message?: string;
}) {
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: true },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-zinc-50 to-white px-6 py-12 text-zinc-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Авторизация</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Используйте корпоративный email для входа или регистрации.
        </p>
        <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          Подтверждение регистрации проходит через одноразовый код на почте.
        </div>
        {message ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {message}
          </div>
        ) : null}
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm text-zinc-600">Загрузка...</div>}>
            <AuthSwitcher
              initialMode={initialMode}
              schools={schools.map((s) => ({
                id: s.id,
                label: s.region ? `${s.name} (${s.region})` : s.name,
              }))}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
