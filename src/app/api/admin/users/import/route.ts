import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";

const rowSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  departmentCode: z.string().min(1),
  role: z.enum(["ADMIN", "DEPARTMENT_HEAD", "EMPLOYEE"]).optional(),
});

function randomPassword(length = 12) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }

  const ab = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "NO_SHEET" }, { status: 400 });

  // Expect header row.
  const headerRow = ws.getRow(1);
  const headers = headerRow.values as Array<string | number | null>;
  const map: Record<string, number> = {};
  headers.forEach((v, idx) => {
    if (typeof v === "string") map[v.trim().toLowerCase()] = idx;
  });

  const idxEmail = map["email"];
  const idxPassword = map["password"];
  const idxDepartmentCode = map["departmentcode"];
  const idxRole = map["role"];

  if (!idxEmail || !idxDepartmentCode) {
    return NextResponse.json(
      { error: "INVALID_HEADERS (need Email and DepartmentCode)" },
      { status: 400 },
    );
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  // Preload departments by code.
  const depts = (await prisma.department.findMany({
    select: { id: true, code: true },
  })) as Array<{ id: string; code: string }>;
  const deptByCode = new Map(depts.map((d: { id: string; code: string }) => [d.code.toLowerCase(), d.id]));

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const email = String(row.getCell(idxEmail).text || "").trim();
    const password = idxPassword ? String(row.getCell(idxPassword).text || "").trim() : "";
    const departmentCode = String(row.getCell(idxDepartmentCode).text || "").trim();
    const role = idxRole ? String(row.getCell(idxRole).text || "").trim() : "";

    if (!email || !departmentCode) {
      skipped++;
      continue;
    }

    const parsed = rowSchema.safeParse({
      email,
      password: password || undefined,
      departmentCode,
      role: role || undefined,
    });
    if (!parsed.success) {
      failed++;
      continue;
    }

    const deptId = deptByCode.get(parsed.data.departmentCode.toLowerCase());
    if (!deptId) {
      failed++;
      continue;
    }

    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (exists) {
      skipped++;
      continue;
    }

    const pass = parsed.data.password ?? randomPassword();
    const passwordHash = await bcrypt.hash(pass, 12);

    await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role ?? "EMPLOYEE",
        departmentId: deptId,
        firstName: "",
        lastName: "",
      },
    });
    created++;
  }

  return NextResponse.json({ ok: true, created, skipped, failed });
}
