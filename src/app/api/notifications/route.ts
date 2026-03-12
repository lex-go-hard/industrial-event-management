import { prisma } from "@/lib/prisma";
import { enforceRateLimit, handleCors, json, logApiAction } from "@/lib/api/guard";
import { safeAuth } from "@/lib/auth-safe";

export async function GET(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;
  const rl = await enforceRateLimit(req, { points: 60, duration: 60 });
  if (rl) return rl;

  let session: Awaited<ReturnType<typeof auth>> | null = null;
  try {
    session = await safeAuth();
  } catch (err) {
    console.warn("Auth session decode failed:", err);
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }
  if (!session?.user) {
    await logApiAction({ req, status: 401, userId: null });
    return json({ error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const where: { userId: string; createdAt?: { gt: Date } } = {
    userId: session.user.id,
  };

  if (since) {
    const ts = new Date(since);
    if (!Number.isNaN(ts.getTime())) {
      where.createdAt = { gt: ts };
    }
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  await logApiAction({ req, status: 200, userId: session.user.id });
  return json({
    ok: true,
    notifications,
    now: new Date().toISOString(),
  }, { req });
}

export async function OPTIONS(req: Request) {
  return handleCors(req) ?? new Response(null, { status: 204 });
}
