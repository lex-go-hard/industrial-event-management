"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loginTimeoutMs = 8000;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
          const res = (await Promise.race([
            signIn("credentials", {
              email,
              password,
              redirect: false,
              callbackUrl,
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), loginTimeoutMs)),
          ])) as Awaited<ReturnType<typeof signIn>> | null;

          if (!res) {
            setError("Сервер авторизации не отвечает. Попробуйте еще раз.");
            return;
          }

          if (res.error) {
            if (res?.error === "USER_NOT_FOUND") {
              setError("Пользователь с таким email не найден");
            } else if (res?.error === "INVALID_PASSWORD") {
              setError("Неверный пароль");
            } else {
              setError("Не удалось войти. Проверьте email и пароль.");
            }
            return;
          }
          const target = res.url ?? callbackUrl;
          router.replace(target);
          window.setTimeout(() => {
            if (window.location.pathname !== target) {
              window.location.assign(target);
            }
          }, 300);
        } catch (err) {
          console.error("Login failed:", err);
          setError("Не удалось войти. Попробуйте еще раз.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <label className="block text-sm font-medium">
        Email
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className="block text-sm font-medium">
        Пароль
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading ? "Входим..." : "Войти"}
      </button>
    </form>
  );
}
