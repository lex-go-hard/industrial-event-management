import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { Prisma } from "@prisma/client";

type NotificationType =
  | "EVENT_CREATED"
  | "EVENT_CANCELLED"
  | "EVENT_RESCHEDULED"
  | "WORKPLAN_CREATED"
  | "WORKPLAN_UPDATED"
  | "QUARTERLY_REMINDER";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export async function notifyUsers(params: {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  data?: JsonValue;
  email?: { subject: string; text?: string; html?: string };
}) {
  const userIds = Array.from(new Set(params.userIds)).filter(Boolean);
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data:
        params.data === undefined
          ? undefined
          : params.data === null
            ? Prisma.JsonNull
            : (params.data as Prisma.InputJsonValue),
    })),
  });

  if (params.email) {
    const emails = (await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    })) as Array<{ email: string }>;
    const to = emails.map((e: { email: string }) => e.email);
    try {
      await sendEmail({
        to,
        subject: params.email.subject,
        text: params.email.text,
        html: params.email.html,
      });
    } catch (err) {
      console.error("Email send failed:", err);
    }
  }
}
