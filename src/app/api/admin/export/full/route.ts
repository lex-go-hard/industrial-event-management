import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";

import { prisma } from "@/lib/prisma";
import { handleCors, enforceRateLimit, logApiAction } from "@/lib/api/guard";
import { safeAuth } from "@/lib/auth-safe";

export async function GET(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;
  const rl = await enforceRateLimit(req, { points: 30, duration: 60 });
  if (rl) return rl;

  const session = await safeAuth();
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (session.user.role !== "MAIN_APZ_ADMIN") {
    await logApiAction({ req, status: 403, userId: session.user.id });
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `iem_full_export_${ts}.zip`;

  const archive = archiver("zip", { zlib: { level: 9 } });
  const pass = new PassThrough();
  archive.pipe(pass);

  // Collect data (avoid secrets)
  const [
    schools,
    users,
    events,
    participations,
    notifications,
    auditLogs,
    apiLogs,
    roster,
    quarterlyImports,
  ] = await Promise.all([
    prisma.school.findMany(),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        schoolId: true,
        isApproved: true,
        createdById: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.event.findMany(),
    prisma.eventParticipation.findMany(),
    prisma.notification.findMany(),
    prisma.auditLog.findMany(),
    prisma.apiActionLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.rosterEntry.findMany(),
    prisma.quarterlyReminderImport.findMany(),
  ]);

  archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), baseUrl: url.origin }, null, 2), {
    name: "meta.json",
  });
  archive.append(JSON.stringify(schools, null, 2), { name: "schools.json" });
  archive.append(JSON.stringify(users, null, 2), { name: "users.json" });
  archive.append(JSON.stringify(events, null, 2), { name: "events.json" });
  archive.append(JSON.stringify(participations, null, 2), { name: "event_participations.json" });
  archive.append(JSON.stringify(notifications, null, 2), { name: "notifications.json" });
  archive.append(JSON.stringify(auditLogs, null, 2), { name: "audit_logs.json" });
  archive.append(JSON.stringify(apiLogs, null, 2), { name: "api_action_logs.json" });
  archive.append(JSON.stringify(roster, null, 2), { name: "roster_entries.json" });
  archive.append(JSON.stringify(quarterlyImports, null, 2), { name: "quarterly_imports.json" });

  archive.finalize();

  await logApiAction({ req, status: 200, userId: session.user.id });

  const webStream = Readable.toWeb(pass) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}


