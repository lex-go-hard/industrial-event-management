"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm, type SchoolOption } from "@/components/auth/register-form";

type Mode = "signin" | "signup";

export function AuthSwitcher({
  schools,
  initialMode = "signin",
}: {
  schools: SchoolOption[];
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="relative inline-flex rounded-full bg-zinc-100 p-1">
          <span
            className={`absolute left-1 top-1 h-9 w-28 rounded-full bg-white shadow-sm transition-transform ${
              mode === "signup" ? "translate-x-28" : "translate-x-0"
            }`}
          />
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`relative z-10 h-9 w-28 rounded-full text-sm font-medium transition-colors ${
              mode === "signin" ? "text-zinc-900" : "text-zinc-500"
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`relative z-10 h-9 w-28 rounded-full text-sm font-medium transition-colors ${
              mode === "signup" ? "text-zinc-900" : "text-zinc-500"
            }`}
          >
            Регистрация
          </button>
        </div>
      </div>

      {mode === "signin" ? <LoginForm /> : <RegisterForm schools={schools} />}
    </div>
  );
}
