import { redirect } from "next/navigation";
import { ExcelImportForm } from "@/components/admin/excel-import-form";
import { safeAuth } from "@/lib/auth-safe";

export default async function AdminUserImportPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Массовое добавление пользователей (Excel)
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Загрузите .xlsx с колонками: Email, Password (optional), DepartmentCode, Role (optional).
        </p>
        <div className="mt-6">
          <ExcelImportForm />
        </div>
      </div>
    </div>
  );
}

