"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  createdAt: string;
};

export function NotificationsWidget() {
  const [items, setItems] = useState<Notification[]>([]);
  const [lastTs, setLastTs] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const qs = lastTs ? `?since=${encodeURIComponent(lastTs)}` : "";
      const res = await fetch(`/api/notifications${qs}`, {
        cache: "no-store",
      }).catch(() => null);
      if (!res || !res.ok) {
        if (!cancelled) setTimeout(tick, 15000);
        return;
      }
      const data = (await res.json()) as {
        notifications: Notification[];
        now: string;
      };
      if (!cancelled) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const merged = [...data.notifications, ...prev.filter((n) => !existingIds.has(n.id))];
          return merged.slice(0, 50);
        });
        setLastTs(data.now);
        setTimeout(tick, 10000);
      }
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [lastTs]);

  return (
    <div className="space-y-3">
      {items.slice(0, 5).map((n) => (
        <div key={n.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">{n.title}</div>
            <Badge className="uppercase text-[10px]">
              {n.type.replace(/_/g, " ")}
            </Badge>
          </div>
          {n.body ? (
            <p className="mt-1 text-xs text-zinc-600 line-clamp-3">{n.body}</p>
          ) : null}
          <div className="mt-1 text-[10px] text-zinc-400">
            {new Date(n.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Нет новых уведомлений.</p>
      ) : null}
    </div>
  );
}

