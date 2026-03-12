import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/services/notifications";
import { enforceRateLimit, handleCors, json, logApiAction } from "@/lib/api/guard";
import { Prisma } from "@prisma/client";
import { safeAuth } from "@/lib/auth-safe";

const createSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  contentJson: z.unknown(),
});

export async function OPTIONS(req: Request) {
  return handleCors(req) ?? new NextResponse(null, { status: 204 });
}

export async function GET(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;
  const rl = await enforceRateLimit(req, { points: 120, duration: 60 });
  if (rl) return rl;

  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "INVALID_QUERY" }, { status: 400, req });
  }

  const plan = await prisma.workPlan.findUnique({
    where: { ownerId_year_month: { ownerId: session.user.id, year, month } },
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json({ ok: true, plan }, { req });
}

export async function POST(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;
  const rl = await enforceRateLimit(req);
  if (rl) return rl;

  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "INVALID_INPUT" }, { status: 400, req });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { departmentId: true },
  });
  if (!user?.departmentId) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "NO_DEPARTMENT" }, { status: 400, req });
  }

  const contentJson =
    parsed.data.contentJson === null
      ? Prisma.JsonNull
      : (parsed.data.contentJson as Prisma.InputJsonValue);

  const plan = await prisma.workPlan.upsert({
    where: {
      ownerId_year_month: {
        ownerId: session.user.id,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    },
    create: {
      ownerId: session.user.id,
      departmentId: user.departmentId,
      year: parsed.data.year,
      month: parsed.data.month,
      contentJson,
    },
    update: {
      contentJson,
    },
  });

  await notifyUsers({
    userIds: [session.user.id],
    type: "WORKPLAN_UPDATED",
    title: "План работ обновлен",
    body: `План на ${parsed.data.month}.${parsed.data.year} сохранен.`,
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json({ ok: true, plan }, { req });
}
