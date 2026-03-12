"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/services/notifications";
import { safeAuth } from "@/lib/auth-safe";

type UserIdRow = { id: string };

export async function createEnterpriseEventAction(params: {
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
}) {
  const session = await safeAuth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  if (session.user.role !== "ADMIN") throw new Error("FORBIDDEN");

  const event = await prisma.event.create({
    data: {
      title: params.title,
      description: params.description,
      location: params.location,
      startsAt: new Date(params.startsAt),
      endsAt: params.endsAt ? new Date(params.endsAt) : null,
      status: "PLANNED",
      departmentId: null,
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

  revalidatePath("/events");
}

export async function cancelEventAction(eventId: string) {
  const session = await safeAuth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  if (session.user.role !== "ADMIN") throw new Error("FORBIDDEN");

  const before = await prisma.event.findUnique({ where: { id: eventId } });
  if (!before) throw new Error("NOT_FOUND");

  const next = await prisma.event.update({
    where: { id: eventId },
    data: { status: "CANCELLED" },
  });

  const users = (await prisma.user.findMany({ select: { id: true } })) as UserIdRow[];
  await notifyUsers({
    userIds: users.map((u: UserIdRow) => u.id),
    type: "EVENT_CANCELLED",
    title: "Мероприятие отменено",
    body: `${next.title} (${before.startsAt.toLocaleString()})`,
    data: { eventId: next.id },
    email: {
      subject: `Отмена мероприятия: ${next.title}`,
      text: `Отменено мероприятие предприятия: ${next.title}\nБыло: ${before.startsAt.toLocaleString()}`,
    },
  });

  revalidatePath("/events");
}

export async function rescheduleEventAction(eventId: string, startsAt: string) {
  const session = await safeAuth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  if (session.user.role !== "ADMIN") throw new Error("FORBIDDEN");

  const before = await prisma.event.findUnique({ where: { id: eventId } });
  if (!before) throw new Error("NOT_FOUND");

  const next = await prisma.event.update({
    where: { id: eventId },
    data: { startsAt: new Date(startsAt) },
  });

  const users = (await prisma.user.findMany({ select: { id: true } })) as UserIdRow[];
  await notifyUsers({
    userIds: users.map((u: UserIdRow) => u.id),
    type: "EVENT_RESCHEDULED",
    title: "Мероприятие перенесено",
    body: `${next.title}\nБыло: ${before.startsAt.toLocaleString()}\nСтало: ${next.startsAt.toLocaleString()}`,
    data: { eventId: next.id },
    email: {
      subject: `Перенос мероприятия: ${next.title}`,
      text: `Мероприятие перенесено: ${next.title}\nБыло: ${before.startsAt.toLocaleString()}\nСтало: ${next.startsAt.toLocaleString()}`,
    },
  });

  revalidatePath("/events");
}
