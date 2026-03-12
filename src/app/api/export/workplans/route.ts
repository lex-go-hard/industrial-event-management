import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import fs from "node:fs";
import path from "node:path";
import { safeAuth } from "@/lib/auth-safe";

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

  // Only own plan (ADMIN can still export own; enterprise export can be added later)
  const plan = await prisma.workPlan.findUnique({
    where: { ownerId_year_month: { ownerId: session.user.id, year, month } },
  });

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("WorkPlan");
    ws.addRow(["Месяц", "Год", "OwnerId"]);
    ws.addRow([month, year, session.user.id]);
    ws.addRow([]);
    ws.addRow(["Content (JSON)"]);
    ws.addRow([plan ? JSON.stringify(plan.contentJson) : ""]);

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="workplan_${year}_${month}.xlsx"`,
      },
    });
  }

  const logoPath = path.join(process.cwd(), "public", "company-logo.png");
  const hasLogo = fs.existsSync(logoPath);
  const title = `План работ на ${month}.${year}`;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: title, bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: hasLogo
                  ? "Логотип подключается из public/company-logo.png"
                  : "Добавьте логотип: public/company-logo.png",
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: plan ? JSON.stringify(plan.contentJson, null, 2) : "" }),
            ],
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="workplan_${year}_${month}.docx"`,
    },
  });
}

