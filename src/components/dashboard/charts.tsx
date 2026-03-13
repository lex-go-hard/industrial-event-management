"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ParticipationStat = {
  schoolName: string;
  confirmed: number;
};

type Props = {
  participationByDept: ParticipationStat[];
};

export function DashboardCharts({ participationByDept }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-64 rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="mb-2 text-sm font-medium text-zinc-700">
          Участие по цехам (бар-чарт)
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={participationByDept}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="schoolName" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="confirmed" fill="#18181b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-64 rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="mb-2 text-sm font-medium text-zinc-700">
          Доля участия по цехам (pie)
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip />
            <Pie
              data={participationByDept}
              dataKey="confirmed"
              nameKey="schoolName"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={4}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


