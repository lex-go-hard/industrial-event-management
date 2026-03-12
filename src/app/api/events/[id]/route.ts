import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/services/notifications";
import { enforceRateLimit, handleCors, json, logApiAction } from "@/lib/api/guard";
import { safeAuth } from "@/lib/auth-safe";

type UserIdRow = { id: string };

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = handleCors(req);
  if (cors) return cors;
  const rl = await enforceRateLimit(req);
  if (rl) return rl;

  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }
  if (session.user.role !== "ADMIN") {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return json({ error: "FORBIDDEN" }, { status: 403, req });
  }

  const { id } = await ctx.params;
  const before = await prisma.event.findUnique({ where: { id } });
  if (!before) {
    await logApiAction({ req, status: 404, userId: session.user.id });
    return json({ error: "NOT_FOUND" }, { status: 404, req });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "INVALID_INPUT" }, { status: 400, req });
  }

  const next = await prisma.event.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? undefined,
      location: parsed.data.location ?? undefined,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt:
        parsed.data.endsAt === null
          ? null
          : parsed.data.endsAt
            ? new Date(parsed.data.endsAt)
            : undefined,
      status: parsed.data.status,
    },
  });

  const users = (await prisma.user.findMany({ select: { id: true } })) as UserIdRow[];
  const userIds = users.map((u: UserIdRow) => u.id);

  const wasCancelled = before.status === "CANCELLED";
  const isCancelled = next.status === "CANCELLED";
  const rescheduled = before.startsAt.getTime() !== next.startsAt.getTime();

  if (!wasCancelled && isCancelled) {
    await notifyUsers({
      userIds,
      type: "EVENT_CANCELLED",
      title: "Мероприятие отменено",
      body: `${next.title} (${before.startsAt.toLocaleString()})`,
      data: { eventId: next.id },
      email: {
        subject: `Отмена мероприятия: ${next.title}`,
        text: `Отменено мероприятие предприятия: ${next.title}\nБыло: ${before.startsAt.toLocaleString()}`,
      },
    });
  } else if (rescheduled && !isCancelled) {
    await notifyUsers({
      userIds,
      type: "EVENT_RESCHEDULED",
      title: "Мероприятие перенесено",
      body: `${next.title}\nБыло: ${before.startsAt.toLocaleString()}\nСтало: ${next.startsAt.toLocaleString()}`,
      data: { eventId: next.id },
      email: {
        subject: `Перенос мероприятия: ${next.title}`,
        text: `Мероприятие перенесено: ${next.title}\nБыло: ${before.startsAt.toLocaleString()}\nСтало: ${next.startsAt.toLocaleString()}`,
      },
    });
  }

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json({ ok: true, event: next }, { req });
}

export async function OPTIONS(req: Request) {
  return handleCors(req) ?? new Response(null, { status: 204 });
}
