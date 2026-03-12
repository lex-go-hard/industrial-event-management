import { redirect } from "next/navigation";
import { safeAuth } from "@/lib/auth-safe";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}

