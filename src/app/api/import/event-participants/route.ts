import { NextResponse } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import mammoth from "mammoth";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { safeAuth } from "@/lib/auth-safe";

const itemSchema = z.object({
  email: z.string().email(),
  participant: z.boolean().default(true),
  prizePlace: z.number().int().min(1).max(10).optional().nullable(),
  ratingPoints: z.number().int().min(0).max(10000).optional().nullable(),
});

const payloadSchema = z.object({
  eventId: z.string().min(1),
  schoolId: z.string().min(1),
  items: z.array(itemSchema).min(1),
});

async function parseExcel(file: File) {
  const ab = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const headers = headerRow.values as Array<string | number | null>;
  const map: Record<string, number> = {};
  headers.forEach((v, idx) => {
    if (typeof v === "string") map[v.trim().toLowerCase()] = idx;
  });

  const idxEmail = map["email"];
  const idxParticipant = map["participant"];
  const idxPrize = map["prizeplace"];
  const idxPoints = map["ratingpoints"];

  if (!idxEmail) return [];

  const out: Array<z.infer<typeof itemSchema>> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const email = String(row.getCell(idxEmail).text || "").trim();
    if (!email) continue;
    const participantRaw = idxParticipant
      ? String(row.getCell(idxParticipant).text || "").trim()
      : "";
    const participant =
      participantRaw === ""
        ? true
        : ["1", "да", "yes", "true"].includes(participantRaw.toLowerCase());

    const prizeRaw = idxPrize ? String(row.getCell(idxPrize).text || "").trim() : "";
    const pointsRaw = idxPoints ? String(row.getCell(idxPoints).text || "").trim() : "";
    const prizePlace = prizeRaw ? Number(prizeRaw) : null;
    const ratingPoints = pointsRaw ? Number(pointsRaw) : null;

    out.push({
      email,
      participant,
      prizePlace: Number.isFinite(prizePlace as number) ? (prizePlace as number) : null,
      ratingPoints: Number.isFinite(ratingPoints as number) ? (ratingPoints as number) : null,
    });
  }
  return out;
}

async function parseWord(file: File) {
  const ab = await file.arrayBuffer();
  const res = await mammoth.extractRawText({
    arrayBuffer: ab as unknown as ArrayBuffer,
  });
  const text = res.value ?? "";
  // Expect lines like: email;prizePlace;ratingPoints;participant
  const items: Array<z.infer<typeof itemSchema>> = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const [email, prize, points, participant] = s.split(/[;,\t]/).map((x) => x.trim());
    if (!email) continue;
    const prizePlace = prize ? Number(prize) : null;
    const ratingPoints = points ? Number(points) : null;
    const participantBool =
      participant === undefined || participant === ""
        ? true
        : ["1", "да", "yes", "true"].includes(participant.toLowerCase());
    items.push({
      email,
      participant: participantBool,
      prizePlace: Number.isFinite(prizePlace as number) ? (prizePlace as number) : null,
      ratingPoints: Number.isFinite(ratingPoints as number) ? (ratingPoints as number) : null,
    });
  }
  return items;
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (session.user.role !== "MAIN_APZ_ADMIN" && session.user.role !== "ZAVUCH") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId") ?? "";
  const schoolId = searchParams.get("schoolId") ?? "";
  if (!eventId || !schoolId) {
    return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "NO_FILE" }, { status: 400 });

  const name = file.name.toLowerCase();
  const items =
    name.endsWith(".xlsx") ? await parseExcel(file) : name.endsWith(".docx") ? await parseWord(file) : [];

  const payload = payloadSchema.safeParse({ eventId, schoolId, items });
  if (!payload.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const users = (await prisma.user.findMany({
    where: { schoolId, email: { in: payload.data.items.map((i) => i.email) } },
    select: { id: true, email: true },
  })) as Array<{ id: string; email: string }>;
  const userByEmail = new Map(
    users.map((u: { id: string; email: string }) => [u.email.toLowerCase(), u.id]),
  );

  let upserted = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const i of payload.data.items) {
      const userId = userByEmail.get(i.email.toLowerCase());
      if (!userId) {
        skipped++;
        continue;
      }
      if (!i.participant) {
        await tx.eventParticipation.deleteMany({ where: { eventId, userId } });
        upserted++;
        continue;
      }
      await tx.eventParticipation.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
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
      upserted++;
    }
  });

  return NextResponse.json({ ok: true, upserted, skipped });
}


