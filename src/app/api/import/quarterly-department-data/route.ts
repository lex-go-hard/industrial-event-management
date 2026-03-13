import { NextResponse } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import mammoth from "mammoth";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { enforceRateLimit, handleCors, json, logApiAction } from "@/lib/api/guard";
import { safeAuth } from "@/lib/auth-safe";

const rowSchema = z.record(z.string(), z.string().nullable().optional());

const payloadSchema = z.object({
  schoolId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
  rows: z.array(rowSchema).min(1),
});

async function parseExcel(file: File) {
  const ab = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) return [] as Array<Record<string, string>>;

  const headerRow = ws.getRow(1);
  const headers = headerRow.values as Array<string | number | null>;
  const cols: string[] = [];
  headers.forEach((v, idx) => {
    if (!idx) return;
    if (typeof v === "string" && v.trim()) cols[idx] = v.trim();
  });

  const rows: Array<Record<string, string>> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const record: Record<string, string> = {};
    let hasValue = false;
    cols.forEach((name, idx) => {
      if (!name) return;
      const text = String(row.getCell(idx).text || "").trim();
      if (text) hasValue = true;
      record[name] = text;
    });
    if (hasValue) rows.push(record);
  }

  return rows;
}

async function parseWord(file: File) {
  const ab = await file.arrayBuffer();
  const res = await mammoth.extractRawText({
    arrayBuffer: ab as unknown as ArrayBuffer,
  });
  const text = res.value ?? "";
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (!lines.length) return [] as Array<Record<string, string>>;

  const header = lines[0].split(/[;,\t]/).map((x) => x.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/[;,\t]/).map((x) => x.trim());
    const record: Record<string, string> = {};
    let hasValue = false;
    for (let c = 0; c < header.length; c++) {
      const key = header[c];
      if (!key) continue;
      const val = parts[c] ?? "";
      if (val) hasValue = true;
      record[key] = val;
    }
    if (hasValue) rows.push(record);
  }
  return rows;
}

export async function POST(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;
  const rl = await enforceRateLimit(req, { points: 20, duration: 60 });
  if (rl) return rl;

  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }
  if (session.user.role !== "MAIN_APZ_ADMIN" && session.user.role !== "ZAVUCH") {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return json({ error: "FORBIDDEN" }, { status: 403, req });
  }

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get("schoolId") ?? "";
  const year = Number(searchParams.get("year"));
  const quarter = Number(searchParams.get("quarter"));

  if (!schoolId || !Number.isFinite(year) || !Number.isFinite(quarter)) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "INVALID_QUERY" }, { status: 400, req });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "NO_FILE" }, { status: 400, req });
  }

  const ext = file.name.toLowerCase();
  const rows =
    ext.endsWith(".xlsx") ? await parseExcel(file) : ext.endsWith(".docx") ? await parseWord(file) : [];

  const parsed = payloadSchema.safeParse({
    schoolId,
    year,
    quarter,
    rows,
  });
  if (!parsed.success) {
    await logApiAction({ req, status: 400, userId: session.user.id });
    return json({ error: "INVALID_DATA" }, { status: 400, req });
  }

  const contentJson: Prisma.InputJsonValue = {
    sourceFile: file.name,
    rows: parsed.data.rows,
    uploadedBy: session.user
      ? {
          id: session.user.id,
          role: session.user.role,
        }
      : null,
  };

  const record = await prisma.quarterlyReminderImport.upsert({
    where: {
      schoolId_year_quarter: {
        schoolId,
        year,
        quarter,
      },
    },
    create: {
      schoolId,
      year,
      quarter,
      createdById: session.user.id,
      contentJson,
    },
    update: {
      createdById: session.user.id,
      contentJson,
    },
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json({
    ok: true,
    id: record.id,
    rows: parsed.data.rows.length,
  }, { req });
}

export async function OPTIONS(req: Request) {
  return handleCors(req) ?? new NextResponse(null, { status: 204 });
}


