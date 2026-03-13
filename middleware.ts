import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = new Set(["/login", "/register", "/auth"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await auth();
  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Role checks for dashboards
  const role = session.user.role;
  const isApproved = session.user.isApproved;

  const deny = () => {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("message", "Доступ запрещён");
    return NextResponse.redirect(url);
  };

  if (pathname.startsWith("/admin")) {
    if (role !== "MAIN_APZ_ADMIN") return deny();
  }

  if (pathname.startsWith("/departments")) {
    const allowed =
      role === "MAIN_APZ_ADMIN" || (role === "ZAVUCH" && isApproved);
    if (!allowed) return deny();
  }

  if (pathname.startsWith("/schools")) {
    const allowed =
      role === "MAIN_APZ_ADMIN" || (role === "ZAVUCH" && isApproved);
    if (!allowed) return deny();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

