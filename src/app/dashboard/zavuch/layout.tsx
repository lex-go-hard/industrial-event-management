import { redirect } from "next/navigation";

import { safeAuth } from "@/lib/auth-safe";

export default async function ZavuchDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ZAVUCH") redirect("/");

  return children;
}
