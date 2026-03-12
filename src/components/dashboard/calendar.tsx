import { Badge } from "@/components/ui/badge";

type CalendarEvent = {
  id: string;
  title: string;
  date: string; // ISO date
};

type Props = {
  month: number;
  year: number;
  events: CalendarEvent[];
};

export function EventsCalendar({ month, year, events }: Props) {
  const first = new Date(year, month - 1, 1);
  const startWeekday = (first.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: Array<{ day: number | null; events: CalendarEvent[] }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, events: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = new Date(year, month - 1, d).toISOString().slice(0, 10);
    cells.push({
      day: d,
      events: events.filter((e) => e.date.slice(0, 10) === dateStr),
    });
  }

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-zinc-700">
        Календарь мероприятий — {month}.{year}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-2xl border border-zinc-200 bg-zinc-200 text-xs">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <div
            key={d}
            className="bg-zinc-50 px-2 py-1 text-center font-medium text-zinc-600"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={idx} className="min-h-[64px] bg-white p-1 align-top">
            {cell.day ? (
              <div className="mb-1 text-[10px] font-semibold text-zinc-500">
                {cell.day}
              </div>
            ) : null}
            <div className="space-y-1">
              {cell.events.slice(0, 3).map((e) => (
                <Badge
                  key={e.id}
                  className="block truncate border-none bg-zinc-900/5 text-[10px] text-zinc-800"
                >
                  {e.title}
                </Badge>
              ))}
              {cell.events.length > 3 ? (
                <div className="text-[10px] text-zinc-400">
                  +{cell.events.length - 3} ещё
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

