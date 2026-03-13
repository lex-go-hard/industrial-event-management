import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { safeAuth } from "@/lib/auth-safe";

export async function GET(req: Request) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId") ?? "";
  const schoolId = searchParams.get("schoolId") ?? "";
  if (!eventId || !schoolId) {
    return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  }

  const rows = await prisma.eventParticipation.findMany({
    where: {
      eventId,
      user: { schoolId },
    },
    include: {
      user: {
        select: {
          email: true,
          rosterEntries: {
            where: { schoolId },
            select: {
              firstName: true,
              lastName: true,
              middleName: true,
              dateOfBirth: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ prizePlace: "asc" }, { ratingPoints: "desc" }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rating");
  ws.addRow(["Email", "ФИО", "Дата рождения", "Статус", "Призовое место", "Баллы"]);
  for (const p of rows) {
    const roster = p.user.rosterEntries?.[0];
    const fio = roster ? `${roster.lastName} ${roster.firstName} ${roster.middleName ?? ""}`.trim() : "";
    ws.addRow([
      p.user.email,
      fio,
      roster?.dateOfBirth ?? "",
      p.status,
      p.prizePlace ?? "",
      p.ratingPoints ?? "",
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="event_${eventId}_rating.xlsx"`,
    },
  });
}







