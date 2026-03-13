"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type OverviewResponse = {
  totals: {
    schools: number;
    classes: number;
    students: number;
  };
  schools: Array<{
    id: string;
    name: string;
    region: string;
    classCount: number;
    profileClassCount: number;
    studentCount: number;
  }>;
  regions: Array<{
    region: string;
    schools: number;
    students: number;
  }>;
  topClasses: Array<{
    classId: string;
    className: string;
    schoolName: string;
    awards: number;
  }>;
};

type SchoolStatsResponse = {
  school: { id: string; name: string; region: string | null };
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: number | null;
    classTeacher: { id: string; email: string } | null;
    profileClass: { id: string; name: string } | null;
    students: number;
  }>;
};

type ClassStatsResponse = {
  class: {
    id: string;
    name: string;
    gradeLevel: number | null;
    school: { id: string; name: string };
    classTeacher: { id: string; email: string } | null;
    profileClass: { id: string; name: string; studentCount: number; formationYear: number } | null;
  };
  stats: {
    studentCount: number;
    awardsCount: number;
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = typeof body?.error === "string" ? body.error : "REQUEST_FAILED";
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function AdminStatsDashboard() {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["admin-stats-overview"],
    queryFn: () => fetchJson<OverviewResponse>("/api/admin/stats"),
  });

  const schoolQuery = useQuery({
    queryKey: ["admin-stats-school", selectedSchoolId],
    queryFn: () => fetchJson<SchoolStatsResponse>(`/api/admin/stats/school/${selectedSchoolId}`),
    enabled: !!selectedSchoolId,
  });

  const classQuery = useQuery({
    queryKey: ["admin-stats-class", selectedClassId],
    queryFn: () => fetchJson<ClassStatsResponse>(`/api/admin/stats/class/${selectedClassId}`),
    enabled: !!selectedClassId,
  });

  const isLoading = overviewQuery.isLoading || schoolQuery.isLoading || classQuery.isLoading;
  const error = overviewQuery.error || schoolQuery.error || classQuery.error;

  const regionData = useMemo(() => overviewQuery.data?.regions ?? [], [overviewQuery.data]);
  const topClasses = useMemo(() => overviewQuery.data?.topClasses ?? [], [overviewQuery.data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-100 px-6 py-8 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Дашборд администратора</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Сводные показатели, статистика школ и классов.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Не удалось загрузить данные: {error instanceof Error ? error.message : "Ошибка"}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase text-zinc-500">Всего школ</p>
            <p className="mt-2 text-3xl font-semibold">{overviewQuery.data?.totals.schools ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase text-zinc-500">Всего классов</p>
            <p className="mt-2 text-3xl font-semibold">{overviewQuery.data?.totals.classes ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase text-zinc-500">Всего учеников</p>
            <p className="mt-2 text-3xl font-semibold">{overviewQuery.data?.totals.students ?? "—"}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Школы</h2>
            <p className="mt-1 text-xs text-zinc-500">Кликните по строке, чтобы открыть статистику школы.</p>
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Школа</th>
                    <th className="px-3 py-2">Регион</th>
                    <th className="px-3 py-2">Классы</th>
                    <th className="px-3 py-2">Ученики</th>
                  </tr>
                </thead>
                <tbody>
                  {(overviewQuery.data?.schools ?? []).map((s) => (
                    <tr
                      key={s.id}
                      className={`cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 ${
                        selectedSchoolId === s.id ? "bg-zinc-50" : ""
                      }`}
                      onClick={() => {
                        setSelectedSchoolId(s.id);
                        setSelectedClassId(null);
                      }}
                    >
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.region}</td>
                      <td className="px-3 py-2">{s.classCount}</td>
                      <td className="px-3 py-2">{s.studentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Участие по регионам</h2>
            <p className="mt-1 text-xs text-zinc-500">Количество учеников по регионам.</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="region" tick={{ fontSize: 10 }} interval={0} angle={-25} height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="students" name="Ученики" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Топ-классы по наградам</h2>
          <p className="mt-1 text-xs text-zinc-500">Количество достижений типа «Награды».</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClasses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" tick={{ fontSize: 10 }} interval={0} angle={-20} height={60} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="awards" name="Награды" fill="#c2410c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {selectedSchoolId && schoolQuery.data ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">
                  Статистика школы: {schoolQuery.data.school.name}
                </h2>
                <p className="text-xs text-zinc-500">{schoolQuery.data.school.region ?? "Регион не указан"}</p>
              </div>
              <button
                className="text-xs text-zinc-500 underline"
                onClick={() => setSelectedSchoolId(null)}
              >
                Сбросить
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Класс</th>
                    <th className="px-3 py-2">Ученики</th>
                    <th className="px-3 py-2">Профиль</th>
                    <th className="px-3 py-2">Классный руководитель</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolQuery.data.classes.map((c) => (
                    <tr
                      key={c.id}
                      className={`cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 ${
                        selectedClassId === c.id ? "bg-zinc-50" : ""
                      }`}
                      onClick={() => setSelectedClassId(c.id)}
                    >
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2">{c.students}</td>
                      <td className="px-3 py-2">{c.profileClass?.name ?? "—"}</td>
                      <td className="px-3 py-2">{c.classTeacher?.email ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {selectedClassId && classQuery.data ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">
                  Статистика класса: {classQuery.data.class.name}
                </h2>
                <p className="text-xs text-zinc-500">{classQuery.data.class.school.name}</p>
              </div>
              <button
                className="text-xs text-zinc-500 underline"
                onClick={() => setSelectedClassId(null)}
              >
                Сбросить
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase text-zinc-500">Ученики</p>
                <p className="mt-2 text-2xl font-semibold">{classQuery.data.stats.studentCount}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase text-zinc-500">Награды</p>
                <p className="mt-2 text-2xl font-semibold">{classQuery.data.stats.awardsCount}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase text-zinc-500">Профиль</p>
                <p className="mt-2 text-sm font-medium">
                  {classQuery.data.class.profileClass?.name ?? "—"}
                </p>
                <p className="text-xs text-zinc-500">
                  {classQuery.data.class.profileClass
                    ? `${classQuery.data.class.profileClass.formationYear} • ${classQuery.data.class.profileClass.studentCount} уч.`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-zinc-500">Загрузка данных…</p>
        ) : null}
      </div>
    </div>
  );
}
