"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Period = "day" | "week" | "month" | "year";

function useClients() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
}

function useProjects(clientId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["projects-for-stats", clientId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      let q = supabase
        .from("projects")
        .select("id, name, client_id, clients(id, hourly_rate_usd)")
        .eq("user_id", user.id);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        client_id: string;
        clients:
          | { id: string; hourly_rate_usd: number }
          | { id: string; hourly_rate_usd: number }[]
          | null;
      }[];
    },
  });
}

type EarningsByPeriod = { label: string; earnings: number; minutes: number };

function useEarningsStats(clientId: string | null, projectId: string | null, period: Period) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["earnings-stats", clientId, projectId, period],
    queryFn: async (): Promise<{
      totalEarnings: number;
      totalMinutes: number;
      byPeriod: EarningsByPeriod[];
    }> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { totalEarnings: 0, totalMinutes: 0, byPeriod: [] };

      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("id, name, client_id, clients(id, hourly_rate_usd)")
        .eq("user_id", user.id);
      if (pErr || !projects?.length) return { totalEarnings: 0, totalMinutes: 0, byPeriod: [] };

      type P = { id: string; client_id: string };
      let projectIds = (projects as P[]).map((p) => p.id);
      if (clientId)
        projectIds = (projects as P[]).filter((p) => p.client_id === clientId).map((p) => p.id);
      if (projectId) projectIds = projectIds.filter((id) => id === projectId);
      if (projectIds.length === 0) return { totalEarnings: 0, totalMinutes: 0, byPeriod: [] };

      const getHourlyRate = (p: (typeof projects)[number]): number => {
        const c = (
          p as unknown as {
            clients?: { hourly_rate_usd: number } | { hourly_rate_usd: number }[] | null;
          }
        ).clients;
        if (Array.isArray(c)) return c[0]?.hourly_rate_usd ?? 0;
        return c?.hourly_rate_usd ?? 0;
      };
      const projectMap = new Map(
        (projects ?? []).map((p) => [p.id, { clientId: p.client_id, hourlyRate: getHourlyRate(p) }])
      );

      const { data: entries, error: eErr } = await supabase
        .from("time_entries")
        .select("project_id, start_time, end_time")
        .eq("user_id", user.id)
        .in("project_id", projectIds)
        .not("end_time", "is", null);
      if (eErr || !entries?.length) return { totalEarnings: 0, totalMinutes: 0, byPeriod: [] };

      const now = new Date();
      const buckets: { start: Date; label: string }[] = [];

      if (period === "day") {
        for (let i = 0; i < 30; i++) {
          const d = subDays(now, 29 - i);
          buckets.push({ start: startOfDay(d), label: format(d, "MMM d") });
        }
      } else if (period === "week") {
        for (let i = 0; i < 12; i++) {
          const d = subWeeks(now, 11 - i);
          const start = startOfWeek(d, { weekStartsOn: 1 });
          buckets.push({ start, label: `Week of ${format(start, "MMM d")}` });
        }
      } else if (period === "month") {
        for (let i = 0; i < 12; i++) {
          const d = subMonths(now, 11 - i);
          const start = startOfMonth(d);
          buckets.push({ start, label: format(start, "MMM yyyy") });
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const d = subYears(now, 4 - i);
          const start = startOfYear(d);
          buckets.push({ start, label: format(start, "yyyy") });
        }
      }

      const getBucket = (date: Date): { start: Date; label: string } | null => {
        const t = date.getTime();
        for (let i = 0; i < buckets.length; i++) {
          const b = buckets[i];
          const nextStart =
            i < buckets.length - 1 ? buckets[i + 1].start.getTime() : Number.MAX_SAFE_INTEGER;
          if (t >= b.start.getTime() && t < nextStart) return b;
        }
        return null;
      };

      const byPeriodMap = new Map<string, { earnings: number; minutes: number }>();
      buckets.forEach((b) => byPeriodMap.set(b.label, { earnings: 0, minutes: 0 }));

      let totalEarnings = 0;
      let totalMinutes = 0;

      entries.forEach((e) => {
        const proj = projectMap.get(e.project_id);
        if (!proj) return;
        const start = new Date(e.start_time).getTime();
        const end = new Date(e.end_time!).getTime();
        const mins = (end - start) / (60 * 1000);
        const earnings = (mins / 60) * proj.hourlyRate;
        totalEarnings += earnings;
        totalMinutes += mins;
        const bucket = getBucket(new Date(e.start_time));
        if (bucket) {
          const cur = byPeriodMap.get(bucket.label)!;
          cur.earnings += earnings;
          cur.minutes += mins;
        }
      });

      const byPeriod: EarningsByPeriod[] = buckets.map((b) => {
        const cur = byPeriodMap.get(b.label)!;
        return {
          label: b.label,
          earnings: Math.round(cur.earnings * 100) / 100,
          minutes: Math.round(cur.minutes),
        };
      });

      return {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalMinutes: Math.round(totalMinutes),
        byPeriod,
      };
    },
  });
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "day", label: "By day (last 30 days)" },
  { value: "week", label: "By week (last 12 weeks)" },
  { value: "month", label: "By month (last 12 months)" },
  { value: "year", label: "By year (last 5 years)" },
];

export default function StatisticsPage() {
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [period, setPeriod] = useState<Period>("month");

  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects(clientId || null);
  const { data: stats, isLoading } = useEarningsStats(clientId || null, projectId || null, period);

  const totalEarnings = stats?.totalEarnings ?? 0;
  const totalMinutes = stats?.totalMinutes ?? 0;
  const byPeriod = stats?.byPeriod ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
        <p className="text-muted-foreground">
          Your earnings over time. Filter by client or project and choose a time period.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select
            value={clientId || "__all__"}
            onValueChange={(v) => {
              setClientId(v === "__all__" ? "" : v);
              setProjectId("");
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Select
            value={projectId || "__all__"}
            onValueChange={(v) => setProjectId(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Loading…</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#3ECF8E]">{formatCurrency(totalEarnings)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDuration(totalMinutes)} tracked
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Time tracked
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatDuration(totalMinutes)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  In selected period with current filters
                </p>
              </CardContent>
            </Card>
          </div>

          {byPeriod.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Earnings over time</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Earnings by{" "}
                  {period === "day"
                    ? "day"
                    : period === "week"
                      ? "week"
                      : period === "month"
                        ? "month"
                        : "year"}
                  .
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byPeriod} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} width={50} />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "Earnings"]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const p = payload[0].payload as EarningsByPeriod;
                          return (
                            <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
                              <p className="font-medium">{p.label}</p>
                              <p className="text-[#3ECF8E]">{formatCurrency(p.earnings)}</p>
                              <p className="text-muted-foreground text-xs">
                                {formatDuration(p.minutes)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="earnings"
                        fill="#3ECF8E"
                        radius={[4, 4, 0, 0]}
                        name="Earnings"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-64 flex-col items-center justify-center text-center">
                <p className="text-muted-foreground">No earnings in this period.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Log time on projects with clients that have an hourly rate set, or adjust filters.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
