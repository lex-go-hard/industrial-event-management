"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { safeAuth } from "@/lib/auth-safe";
export async function saveWorkPlanAction(params: {
  year: number;
  month: number;
  contentJson: Prisma.InputJsonValue;
}) {
  const session = await safeAuth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });
  if (!user?.schoolId) throw new Error("NO_SCHOOL");

  await prisma.monthlyReport.upsert({
    where: {
      schoolId_year_month: {
        schoolId: user.schoolId,
        year: params.year,
        month: params.month,
      },
    },
    create: {
      schoolId: user.schoolId,
      year: params.year,
      month: params.month,
      contentJson: params.contentJson,
      createdById: session.user.id,
    },
    update: {
      contentJson: params.contentJson,
      createdById: session.user.id,
    },
  });

  revalidatePath("/work-plans");
  redirect("/work-plans");
}

