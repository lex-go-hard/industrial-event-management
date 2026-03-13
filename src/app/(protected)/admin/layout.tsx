import { redirect } from "next/navigation";

import { safeAuth } from "@/lib/auth-safe";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "MAIN_APZ_ADMIN") redirect("/auth?message=Доступ запрещён");

  return children;
}
