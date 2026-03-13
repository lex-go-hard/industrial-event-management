import { redirect } from "next/navigation";

import { safeAuth } from "@/lib/auth-safe";

export default async function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLASS_TEACHER") redirect("/");

  return children;
}
