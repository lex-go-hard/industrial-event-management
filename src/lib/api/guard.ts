import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Redis from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { safeAuth } from "@/lib/auth-safe";

const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(origin?: string) {
  const allowOrigin =
    corsOrigins.length === 0
      ? origin ?? "*"
      : origin && corsOrigins.includes(origin)
        ? origin
        : corsOrigins[0];

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers":
      "content-type, authorization, x-cron-secret",
  } as const;
}

export function handleCors(req: Request) {
  const origin = req.headers.get("origin") ?? undefined;
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}

let rateLimiter: RateLimiterRedis | null = null;
function getRateLimiter() {
  if (rateLimiter) return rateLimiter;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const redis = new Redis(url, { maxRetriesPerRequest: 1 });
  rateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "iem:rl",
    points: 120,
    duration: 60,
  });
  return rateLimiter;
}

export async function enforceRateLimit(req: Request, opts?: { points?: number; duration?: number }) {
  const limiter = getRateLimiter();
  if (!limiter) return null;
  if (opts?.points || opts?.duration) {
    limiter.points = opts.points ?? limiter.points;
    limiter.duration = opts.duration ?? limiter.duration;
  }

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    await limiter.consume(ip);
    return null;
  } catch {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
}

export async function logApiAction(params: {
  req: Request;
  status: number;
  userId?: string | null;
}) {
  const url = new URL(params.req.url);
  const ip =
    (params.req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    params.req.headers.get("x-real-ip") ||
    null;

  const ua = params.req.headers.get("user-agent");

  await prisma.apiActionLog.create({
    data: {
      userId: params.userId ?? null,
      method: params.req.method,
      path: url.pathname,
      status: params.status,
      ip,
      userAgent: ua,
    },
  });
}

export async function getSessionUser() {
  const session = await safeAuth();
  return session?.user ?? null;
}

export function json(data: unknown, init?: { status?: number; req?: Request }) {
  const origin = init?.req?.headers.get("origin") ?? undefined;
  return NextResponse.json(data, {
    status: init?.status,
    headers: init?.req ? corsHeaders(origin) : undefined,
  });
}

