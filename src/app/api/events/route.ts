import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/services/notifications";
import { enforceRateLimit, handleCors, json, logApiAction } from "@/lib/api/guard";
import { safeAuth } from "@/lib/auth-safe";

type UserIdRow = { id: string };

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
});

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

  // Employees see ONLY enterprise-wide events => departmentId = null
  const where =
    session.user.role === "ADMIN"
      ? {}
      : {
          departmentId: null,
        };

  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json({ ok: true, events }, { req });
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
  if (session.user.role !== "ADMIN") {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return json({ error: "FORBIDDEN" }, { status: 403, req });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "INVALID_INPUT" }, { status: 400, req });
  }

  const event = await prisma.event.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      status: "PLANNED",
      departmentId: null, // enterprise-wide
      createdById: session.user.id,
    },
  });

  const users = (await prisma.user.findMany({ select: { id: true } })) as UserIdRow[];
  await notifyUsers({
    userIds: users.map((u: UserIdRow) => u.id),
    type: "EVENT_CREATED",
    title: "Новое мероприятие предприятия",
    body: `${event.title} (${event.startsAt.toLocaleString()})`,
    data: { eventId: event.id },
    email: {
      subject: `Новое мероприятие: ${event.title}`,
      text: `Создано мероприятие предприятия: ${event.title}\nДата/время: ${event.startsAt.toLocaleString()}`,
    },
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json({ ok: true, event }, { req });
}

export async function OPTIONS(req: Request) {
  return handleCors(req) ?? new Response(null, { status: 204 });
}
