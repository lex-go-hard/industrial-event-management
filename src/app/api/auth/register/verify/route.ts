import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
});

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { email, code } = parsed.data;

  const pending = await prisma.registrationVerification.findUnique({
    where: { email },
  });

  if (!pending) {
    return NextResponse.json({ error: "REGISTRATION_NOT_FOUND" }, { status: 404 });
  }

  const now = new Date();
  if (pending.expiresAt.getTime() < now.getTime()) {
    return NextResponse.json({ error: "CODE_EXPIRED" }, { status: 410 });
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    await prisma.registrationVerification.delete({ where: { id: pending.id } });
    return NextResponse.json({ error: "RESTART_REQUIRED" }, { status: 410 });
  }

  const ok = await bcrypt.compare(code, pending.codeHash);
  if (!ok) {
    const nextAttempts = pending.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await prisma.registrationVerification.delete({ where: { id: pending.id } });
      return NextResponse.json({ error: "RESTART_REQUIRED" }, { status: 410 });
    }
    await prisma.registrationVerification.update({
      where: { id: pending.id },
      data: { attempts: nextAttempts },
    });
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    await prisma.registrationVerification.delete({ where: { id: pending.id } });
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  if (pending.role === "ZAVUCH" && !pending.schoolId) {
    return NextResponse.json({ error: "SCHOOL_NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: pending.passwordHash,
        role: pending.role,
        schoolId: pending.schoolId,
        isApproved: pending.role === "ZAVUCH" ? false : true,
      },
    });

    if (pending.role === "ZAVUCH") {
      if (!pending.schoolId) throw new Error("SCHOOL_NOT_FOUND");
      await tx.confirmationRequest.create({
        data: {
          userId: user.id,
          status: "PENDING",
          schoolId: pending.schoolId,
        },
      });
    }

    await tx.registrationVerification.delete({ where: { id: pending.id } });
  });

  return NextResponse.json({ ok: true });
}
