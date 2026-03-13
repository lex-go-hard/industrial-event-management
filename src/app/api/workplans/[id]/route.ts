import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/auth-safe";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await ctx.params;
  const plan = await prisma.monthlyReport.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!plan) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (plan.createdById !== session.user.id && session.user.role !== "MAIN_APZ_ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await prisma.monthlyReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}


