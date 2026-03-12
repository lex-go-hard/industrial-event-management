"use client";

import { useState } from "react";

export function ExcelImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  type ImportOk = { ok: true; created: number; skipped: number; failed: number };
  type ImportErr = { error: string };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        if (!file) {
          setError("Выберите файл .xlsx");
          return;
        }
        setLoading(true);
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/users/import", {
          method: "POST",
          body: fd,
        });
        const bodyUnknown: unknown = await res.json().catch(() => null);
        setLoading(false);

        if (!res.ok) {
          const msg =
            typeof (bodyUnknown as ImportErr | null)?.error === "string"
              ? (bodyUnknown as ImportErr).error
              : "Ошибка импорта";
          setError(msg);
          return;
        }
        const ok = bodyUnknown as Partial<ImportOk>;
        setResult(`Создано: ${ok.created ?? 0}, пропущено: ${ok.skipped ?? 0}, ошибок: ${ok.failed ?? 0}`);
      }}
    >
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {result}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading ? "Импорт..." : "Импортировать"}
      </button>
    </form>
  );
}

