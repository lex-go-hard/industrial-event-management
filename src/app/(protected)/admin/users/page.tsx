import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function approveZavuch(userId: string) {
  "use server";
  const session = await safeAuth();
  if (!session?.user || session.user.role !== "MAIN_APZ_ADMIN") redirect("/auth");

  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true },
  });

  await prisma.confirmationRequest.updateMany({
    where: { userId, status: "PENDING" },
    data: {
      status: "APPROVED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

async function deleteUser(userId: string) {
  "use server";
  const session = await safeAuth();
  if (!session?.user || session.user.role !== "MAIN_APZ_ADMIN") redirect("/auth");

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export default async function AdminUsersPage() {
  const session = await safeAuth();
  if (!session?.user) return null;

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      role: true,
      isApproved: true,
      school: { select: { name: true } },
    },
    orderBy: { email: "asc" },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-100 px-6 py-8 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Управление пользователями</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Подтверждение завучей и мягкое удаление аккаунтов.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Пользователи</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-zinc-600">Пользователи не найдены.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{u.email}</p>
                      <p className="text-xs text-zinc-500">
                        {u.role}
                        {u.school?.name ? ` • ${u.school.name}` : ""}
                        {u.role === "ZAVUCH" ? ` • ${u.isApproved ? "Подтверждён" : "Не подтверждён"}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {u.role === "ZAVUCH" && !u.isApproved ? (
                        <form action={approveZavuch.bind(null, u.id)}>
                          <button
                            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
                            type="submit"
                          >
                            Подтвердить
                          </button>
                        </form>
                      ) : null}
                      <form action={deleteUser.bind(null, u.id)}>
                        <button
                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
                          type="submit"
                        >
                          Удалить аккаунт
                        </button>
                      </form>
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
