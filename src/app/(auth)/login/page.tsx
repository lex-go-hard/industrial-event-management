import { LoginForm } from "@/components/auth/login-form";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Введите email и пароль сотрудника.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm text-zinc-600">Загрузка...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

