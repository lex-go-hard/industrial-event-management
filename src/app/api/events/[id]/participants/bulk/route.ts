import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { safeAuth } from "@/lib/auth-safe";

const itemSchema = z.object({
  userId: z.string().min(1),
  participant: z.boolean(),
  prizePlace: z.number().int().min(1).max(10).optional().nullable(),
  ratingPoints: z.number().int().min(0).max(10000).optional().nullable(),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "DEPARTMENT_HEAD") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id: eventId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // Upsert participations; delete missing participants
  const wanted = parsed.data.items;
  const wantedUserIds = wanted.filter((i) => i.participant).map((i) => i.userId);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Remove participations for users marked as not participating
    const notUserIds = wanted.filter((i) => !i.participant).map((i) => i.userId);
    if (notUserIds.length) {
      await tx.eventParticipation.deleteMany({ where: { eventId, userId: { in: notUserIds } } });
    }

    for (const i of wanted) {
      if (!i.participant) continue;
      await tx.eventParticipation.upsert({
        where: { eventId_userId: { eventId, userId: i.userId } },
        create: {
          eventId,
          userId: i.userId,
          status: "CONFIRMED",
          prizePlace: i.prizePlace ?? null,
          ratingPoints: i.ratingPoints ?? null,
        },
        update: {
          status: "CONFIRMED",
          prizePlace: i.prizePlace ?? null,
          ratingPoints: i.ratingPoints ?? null,
        },
      });
    }
  });

  return NextResponse.json({ ok: true, participants: wantedUserIds.length });
}
