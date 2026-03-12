import { prisma } from "@/lib/prisma";
import { saveWorkPlanAction } from "./actions";
import type { Prisma } from "@prisma/client";
import { safeAuth } from "@/lib/auth-safe";

export const dynamic = "force-dynamic";

export default async function WorkPlansPage() {
  const session = await safeAuth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const plan = await prisma.workPlan.findUnique({
    where: { ownerId_year_month: { ownerId: userId, year, month } },
  });

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Мой план работ</h1>
          <div className="flex gap-2">
            <a
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              href={`/api/export/workplans?year=${year}&month=${month}&format=xlsx`}
            >
              Excel
            </a>
            <a
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              href={`/api/export/workplans?year=${year}&month=${month}&format=docx`}
            >
              Word
            </a>
          </div>
        </div>

        <p className="mt-1 text-sm text-zinc-600">
          Видно только вам. Месяц по умолчанию: {month}.{year}
        </p>

        <form
          action={async (formData) => {
            "use server";
            const contentText = String(formData.get("content") ?? "{}");
            let contentJson: Prisma.InputJsonValue = {};
            try {
              contentJson = JSON.parse(contentText) as Prisma.InputJsonValue;
            } catch {
              contentJson = { text: contentText };
            }
            await saveWorkPlanAction({ year, month, contentJson });
          }}
          className="mt-6 space-y-3"
        >
          <label className="block text-sm font-medium">
            Контент (JSON)
            <textarea
              name="content"
              className="mt-1 h-56 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs outline-none ring-zinc-400 focus:ring-2"
              defaultValue={plan ? JSON.stringify(plan.contentJson, null, 2) : "{\n  \"items\": []\n}"}
            />
          </label>

          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
}
