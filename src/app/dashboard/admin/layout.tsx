import { redirect } from "next/navigation";

import { safeAuth } from "@/lib/auth-safe";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MAIN_APZ_ADMIN") redirect("/");

  return children;
}
