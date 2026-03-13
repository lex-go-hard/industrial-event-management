import { AuthPage } from "@/components/auth/auth-page";

export const dynamic = "force-dynamic";

export default async function AuthRoutePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const raw = params.message;
  const message = Array.isArray(raw) ? raw[0] : raw;
  return <AuthPage message={message} />;
}
