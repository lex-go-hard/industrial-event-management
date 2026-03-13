import { AuthPage } from "@/components/auth/auth-page";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <AuthPage initialMode="signup" />;
}
