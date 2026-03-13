import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  schoolId: z.string().min(1),
  role: z.enum(["ZAVUCH", "CLASS_TEACHER"]),
});

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { email, password, schoolId, role } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true },
  });
  if (!school) {
    return NextResponse.json({ error: "SCHOOL_NOT_FOUND" }, { status: 404 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const passwordHash = await bcrypt.hash(password, 12);

  const pending = await prisma.registrationVerification.findUnique({
    where: { email },
  });

  if (pending) {
    if (pending.attempts >= 5) {
      await prisma.registrationVerification.delete({ where: { email } });
    } else {
      const secondsSince = Math.floor((now.getTime() - pending.lastSentAt.getTime()) / 1000);
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          { error: "RESEND_TOO_SOON", retryAfter: RESEND_COOLDOWN_SECONDS - secondsSince },
          { status: 429 },
        );
      }
    }
  }

  if (pending && pending.attempts < 5) {
    await prisma.registrationVerification.update({
      where: { email },
      data: {
        passwordHash,
        schoolId,
        role,
        codeHash,
        expiresAt,
        lastSentAt: now,
      },
    });
  } else {
    await prisma.registrationVerification.create({
      data: {
        email,
        passwordHash,
        schoolId,
        role,
        codeHash,
        expiresAt,
        lastSentAt: now,
      },
    });
  }

  const mail = await sendEmail({
    to: email,
    subject: "Подтверждение регистрации",
    text: `Ваш код подтверждения: ${code}\nКод действует ${CODE_TTL_MINUTES} минут.`,
  });

  if (!mail.ok) {
    return NextResponse.json({ error: "EMAIL_NOT_CONFIGURED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expiresInMinutes: CODE_TTL_MINUTES });
}
