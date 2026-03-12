import { prisma } from "@/lib/prisma";
import { RegisterForm } from "@/components/auth/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Регистрация сотрудника</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Доступна только для сотрудников предприятия.
        </p>
        <div className="mt-6">
          <RegisterForm
            departments={departments.map((d: { id: string; name: string; code: string }) => ({
              id: d.id,
              label: `${d.name} (${d.code})`,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

