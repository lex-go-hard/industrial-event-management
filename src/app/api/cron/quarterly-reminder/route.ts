import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/services/notifications";
import { enforceRateLimit, handleCors, json, logApiAction } from "@/lib/api/guard";

type DepartmentHead = {
  id: string;
  email: string;
  department: { name: string; code: string } | null;
};

function currentQuarter(date = new Date()) {
  const q = Math.floor(date.getMonth() / 3) + 1; // 1-4
  return q;
}

export async function POST(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;
  const isDev = process.env.NODE_ENV === "development";
  const rl = isDev ? null : await enforceRateLimit(req, { points: 10, duration: 60 });
  if (rl) return rl;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    await logApiAction({ req, status: 500, userId: null });
    return json({ error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 500, req });
  }

  const header = req.headers.get("x-cron-secret");
  if (header !== secret) {
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const now = new Date();
  const year = now.getFullYear();
  const quarter = currentQuarter(now);

  const heads = (await prisma.user.findMany({
    where: { role: "DEPARTMENT_HEAD" },
    select: {
      id: true,
      email: true,
      department: { select: { name: true, code: true } },
    },
  })) as DepartmentHead[];

  if (!heads.length) {
    await logApiAction({ req, status: 200, userId: null });
    return json({ ok: true, message: "NO_HEADS" }, { req });
  }

  const title = `Квартальное обновление данных (${quarter} кв. ${year})`;
  const body =
    "Просьба заполнить и обновить данные по мероприятиям, участникам и отчетам за прошедший квартал.";

  await notifyUsers({
    userIds: heads.map((h: DepartmentHead) => h.id),
    type: "QUARTERLY_REMINDER",
    title,
    body,
    email: {
      subject: title,
      text: `${body}\n\nЭто автоматическое напоминание для руководителей подразделений.`,
    },
  });

  await logApiAction({ req, status: 200, userId: null });
  return json(
    {
      ok: true,
      notified: heads.length,
      year,
      quarter,
    },
    { req },
  );
}

export async function OPTIONS(req: Request) {
  return handleCors(req) ?? new NextResponse(null, { status: 204 });
}
