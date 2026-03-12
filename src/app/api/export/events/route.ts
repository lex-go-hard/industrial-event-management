import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import fs from "node:fs";
import path from "node:path";
import { safeAuth } from "@/lib/auth-safe";

type EventRow = {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  status: string;
};

export async function GET(req: Request) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const format = (searchParams.get("format") ?? "xlsx").toLowerCase();

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  const where =
    session.user.role === "ADMIN"
      ? { startsAt: { gte: start, lt: end } }
      : { departmentId: null, startsAt: { gte: start, lt: end } };

  const events = (await prisma.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
  })) as EventRow[];

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Events");
    ws.addRow(["Title", "StartsAt", "EndsAt", "Location", "Status"]);
    for (const e of events) {
      ws.addRow([
        e.title,
        e.startsAt.toISOString(),
        e.endsAt ? e.endsAt.toISOString() : "",
        e.location ?? "",
        e.status,
      ]);
    }
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="events_${year}_${month}.xlsx"`,
      },
    });
  }

  const logoPath = path.join(process.cwd(), "public", "company-logo.png");
  const hasLogo = fs.existsSync(logoPath);
  const title = `Мероприятия на ${month}.${year}`;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: title, bold: true })] }),
          new Paragraph({
            children: [
              new TextRun({
                text: hasLogo
                  ? "Логотип подключается из public/company-logo.png"
                  : "Добавьте логотип: public/company-logo.png",
              }),
            ],
          }),
          ...events.map(
            (e: EventRow) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `- ${e.title} - ${e.startsAt.toLocaleString()} (${e.status})`,
                  }),
                ],
              }),
          ),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="events_${year}_${month}.docx"`,
    },
  });
}
