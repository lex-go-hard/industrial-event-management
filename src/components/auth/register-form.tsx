"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export type SchoolOption = { id: string; label: string };

type Step = "form" | "verify";

type ApiError =
  | "INVALID_INPUT"
  | "EMAIL_TAKEN"
  | "SCHOOL_NOT_FOUND"
  | "EMAIL_NOT_CONFIGURED"
  | "REGISTRATION_NOT_FOUND"
  | "RESEND_TOO_SOON"
  | "CODE_EXPIRED"
  | "INVALID_CODE"
  | "RESTART_REQUIRED";

export function RegisterForm({ schools }: { schools: SchoolOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [role, setRole] = useState<"ZAVUCH" | "CLASS_TEACHER">("CLASS_TEACHER");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const loginTimeoutMs = 8000;

  const canSubmit = useMemo(() => {
    if (step === "verify") return code.length === 6;
    return !!email && password.length >= 8 && !!schoolId;
  }, [step, email, password, schoolId, code]);

  useEffect(() => {
    if (!schoolId && schools.length > 0) {
      setSchoolId(schools[0].id);
    }
  }, [schoolId, schools]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const handleError = (code: ApiError, retryAfter?: number) => {
    switch (code) {
      case "EMAIL_TAKEN":
        setError("Этот email уже зарегистрирован.");
        break;
      case "SCHOOL_NOT_FOUND":
        setError("Школа не найдена. Попробуйте выбрать другую.");
        break;
      case "EMAIL_NOT_CONFIGURED":
        setError("Проверьте корректность почты и повторите отправку.");
        break;
      case "CODE_EXPIRED":
        setError("Срок действия кода истёк. Запросите новый код.");
        break;
      case "INVALID_CODE":
        setError("Неверный код подтверждения.");
        break;
      case "RESEND_TOO_SOON":
        setError(
          retryAfter
            ? `Повторный запрос возможен через ${retryAfter} сек.`
            : "Повторный запрос возможен позже.",
        );
        if (retryAfter && retryAfter > 0) setCooldown(retryAfter);
        break;
      case "RESTART_REQUIRED":
        setError("Слишком много неверных попыток. Регистрация начнётся заново.");
        setStep("form");
        setCode("");
        setCooldown(0);
        break;
      case "REGISTRATION_NOT_FOUND":
        setError("Сессия регистрации не найдена. Попробуйте начать заново.");
        setStep("form");
        setCode("");
        setCooldown(0);
        break;
      default:
        setError("Не удалось выполнить действие. Попробуйте ещё раз.");
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setInfo(null);
        setLoading(true);

        if (step === "form") {
          const res = await fetch("/api/auth/register/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password, schoolId, role }),
          });

          setLoading(false);

          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as
              | { error?: ApiError; retryAfter?: number }
              | null;
            handleError(body?.error ?? "INVALID_INPUT", body?.retryAfter);
            return;
          }

          setStep("verify");
          setCode("");
          setCooldown(60);
          setInfo("Письмо отправлено на почту. Код действует 10 минут.");
          return;
        }

        const res = await fetch("/api/auth/register/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, code }),
        });

        setLoading(false);

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: ApiError; retryAfter?: number }
            | null;
          handleError(body?.error ?? "INVALID_INPUT", body?.retryAfter);
          return;
        }

        const signInRes = (await Promise.race([
          signIn("credentials", {
            email,
            password,
            redirect: false,
            callbackUrl: "/dashboard",
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), loginTimeoutMs)),
        ])) as Awaited<ReturnType<typeof signIn>> | null;

        if (!signInRes) {
          setError("Сервер авторизации не отвечает. Попробуйте войти позже.");
          return;
        }

        if (signInRes.error) {
          router.push("/login");
          return;
        }

        const target = signInRes.url ?? "/dashboard";
        router.replace(target);
        window.setTimeout(() => {
          if (window.location.pathname !== target) {
            window.location.assign(target);
          }
        }, 300);
      }}
    >
      <label className="block text-sm font-medium">
        Email
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={step === "verify"}
        />
      </label>

      <label className="block text-sm font-medium">
        Пароль (минимум 8 символов)
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          disabled={step === "verify"}
        />
      </label>

      <label className="block text-sm font-medium">
        Роль
        <select
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100"
          value={role}
          onChange={(e) => setRole(e.target.value as "ZAVUCH" | "CLASS_TEACHER")}
          required
          disabled={step === "verify"}
        >
          <option value="CLASS_TEACHER">Классный руководитель</option>
          <option value="ZAVUCH">Завуч</option>
        </select>
      </label>

      <label className="block text-sm font-medium">
        Школа
        <select
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          required
          disabled={schools.length === 0 || step === "verify"}
        >
          {schools.length === 0 ? (
            <option value="">Сначала добавьте школы</option>
          ) : (
            schools.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))
          )}
        </select>
      </label>

      {step === "verify" ? (
        <label className="block text-sm font-medium">
          Код подтверждения (6 цифр)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            maxLength={6}
            autoComplete="one-time-code"
          />
        </label>
      ) : null}

      {info ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading
          ? step === "verify"
            ? "Проверяем..."
            : "Отправляем код..."
          : step === "verify"
            ? "Подтвердить"
            : "Зарегистрироваться"}
      </button>

      {step === "verify" ? (
        <button
          type="button"
          onClick={async () => {
            setError(null);
            setInfo(null);
            setLoading(true);
            const res = await fetch("/api/auth/register/resend", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email }),
            });
            setLoading(false);
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as
                | { error?: ApiError; retryAfter?: number }
                | null;
              handleError(body?.error ?? "INVALID_INPUT", body?.retryAfter);
              return;
            }
            setCooldown(60);
            setInfo("Письмо отправлено на почту. Код действует 10 минут.");
          }}
          disabled={loading || cooldown > 0}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {cooldown > 0
            ? `Запросить код повторно через ${cooldown} сек.`
            : "Запросить код повторно"}
        </button>
      ) : null}
    </form>
  );
}
