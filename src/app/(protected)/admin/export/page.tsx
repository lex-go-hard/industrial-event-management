import { redirect } from "next/navigation";
import { safeAuth } from "@/lib/auth-safe";

export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MAIN_APZ_ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Экспорт данных</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Скачает архив со всеми данными (без паролей).
        </p>
        <div className="mt-6">
          <a
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            href="/api/admin/export/full"
          >
            Скачать
          </a>
        </div>
      </div>
    </div>
  );
}

