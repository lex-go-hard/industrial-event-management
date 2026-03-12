"use server";

import { revalidatePath } from "next/cache";
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
    select: { departmentId: true },
  });
  if (!user?.departmentId) throw new Error("NO_DEPARTMENT");

  await prisma.workPlan.upsert({
    where: {
      ownerId_year_month: {
        ownerId: session.user.id,
        year: params.year,
        month: params.month,
      },
    },
    create: {
      ownerId: session.user.id,
      departmentId: user.departmentId,
      year: params.year,
      month: params.month,
      contentJson: params.contentJson,
    },
    update: {
      contentJson: params.contentJson,
    },
  });

  revalidatePath("/work-plans");
}
