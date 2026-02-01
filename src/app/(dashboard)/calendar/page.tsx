"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import type { TimeEntry } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarAddTimeModal } from "./add-time-modal";

function useTimeEntriesForRange(start: Date, end: Date) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["calendar-entries", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("time_entries")
        .select("*, project:projects(id, name)")
        .eq("user_id", user.id)
        .not("end_time", "is", null)
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (TimeEntry & { project?: { id: string; name: string } })[];
    },
  });
}

export default function CalendarPage() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [addTimeOpen, setAddTimeOpen] = useState(false);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rangeStart = new Date(calendarStart);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(calendarEnd);
  rangeEnd.setHours(23, 59, 59, 999);

  const { data: entries = [] } = useTimeEntriesForRange(rangeStart, rangeEnd);

  const entriesByDay = useMemo(() => {
    const map: Record<string, (TimeEntry & { project?: { id: string; name: string } })[]> = {};
    entries.forEach((e) => {
      if (!e.end_time) return;
      const start = parseISO(e.start_time);
      const dayKey = format(start, "yyyy-MM-dd");
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(e);
    });
    return map;
  }, [entries]);

  const calendarDays: Date[] = [];
  let cursor = calendarStart;
  while (cursor <= calendarEnd) {
    calendarDays.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">See where your time was spent by day.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">{format(viewDate, "MMMM yyyy")}</CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setViewDate(new Date())}>
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted/30">
            {weekDays.map((d) => (
              <div
                key={d}
                className="bg-background p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {calendarDays.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const dayEntries = entriesByDay[key] ?? [];
              const totalMins = dayEntries.reduce((acc, e) => {
                if (!e.end_time) return acc;
                const s = new Date(e.start_time).getTime();
                const end = new Date(e.end_time).getTime();
                return acc + (end - s) / (60 * 1000);
              }, 0);
              const inMonth = isSameMonth(d, viewDate);
              const isToday = isSameDay(d, new Date());

              return (
                <div
                  key={key}
                  className={`min-h-[100px] bg-background p-2 ${!inMonth ? "opacity-50" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(d);
                      setAddTimeOpen(true);
                    }}
                    className={`mb-1 flex w-full items-center justify-end gap-1 text-right text-sm font-medium hover:underline ${
                      isToday ? "rounded bg-[#3ECF8E] text-white" : ""
                    }`}
                    title="Click to add time"
                  >
                    {format(d, "d")}
                    <Plus className="h-3 w-3 opacity-70" />
                  </button>
                  <div className="space-y-1">
                    {dayEntries.slice(0, 3).map((e) => {
                      const proj =
                        (e as { project?: { id: string; name: string } }).project?.name ?? "—";
                      const mins = e.end_time
                        ? (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) /
                          (60 * 1000)
                        : 0;
                      return (
                        <Link
                          key={e.id}
                          href={`/dashboard/${e.project_id}`}
                          className="block truncate rounded bg-muted/80 px-1.5 py-0.5 text-xs hover:bg-muted"
                          title={`${proj}: ${formatDuration(Math.round(mins))}`}
                        >
                          <span className="font-medium">{proj}</span>{" "}
                          <span className="text-muted-foreground">
                            {formatDuration(Math.round(mins))}
                          </span>
                        </Link>
                      );
                    })}
                    {dayEntries.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEntries.length - 3} more
                      </div>
                    )}
                    {dayEntries.length > 0 && (
                      <div className="text-xs font-medium text-[#3ECF8E]">
                        {formatDuration(Math.round(totalMins))} total
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <CalendarAddTimeModal
        selectedDate={selectedDate}
        open={addTimeOpen}
        onClose={() => {
          setAddTimeOpen(false);
          setSelectedDate(null);
        }}
        onSubmitted={() => {}}
      />
    </div>
  );
}
