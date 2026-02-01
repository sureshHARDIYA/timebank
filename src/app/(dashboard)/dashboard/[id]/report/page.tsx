"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDuration } from "@/lib/utils";
import type { Client, TimeEntry } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, subDays } from "date-fns";
import { ArrowLeft, FileDown, Mail } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function useProject(id: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

function useTimeEntries(projectId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["time-entries", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("project_id", projectId!)
        .not("end_time", "is", null)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

function useTimeEntryTags(entryIds: string[]) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["time-entry-tags", entryIds.join(",")],
    enabled: entryIds.length > 0,
    queryFn: async () => {
      const { data: links, error: e1 } = await supabase
        .from("time_entry_tags")
        .select("time_entry_id, tag_id")
        .in("time_entry_id", entryIds);
      if (e1 || !links?.length)
        return {
          links: [] as { time_entry_id: string; tag_id: string }[],
          tags: [] as { id: string; name: string; color: string }[],
        };
      const tagIds = Array.from(new Set(links.map((l) => l.tag_id)));
      const { data: tags, error: e2 } = await supabase
        .from("tags")
        .select("id, name, color")
        .in("id", tagIds);
      if (e2) return { links: links as { time_entry_id: string; tag_id: string }[], tags: [] };
      return {
        links: links as { time_entry_id: string; tag_id: string }[],
        tags: (tags ?? []) as { id: string; name: string; color: string }[],
      };
    },
  });
}

export default function ProjectReportPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: project, isLoading } = useProject(id);
  const { data: entries = [] } = useTimeEntries(id);
  const entryIds = entries.map((e) => e.id);
  const { data: tagData } = useTimeEntryTags(entryIds);
  const { links: entryTagLinks = [], tags: tagMeta = [] } = tagData ?? {};

  const totalMinutes = entries.reduce((acc, e) => {
    if (!e.end_time) return acc;
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    return acc + (end - start) / (60 * 1000);
  }, 0);

  const client = project?.clients as Client | undefined;
  const hourlyRate = client?.hourly_rate_usd ?? 0;
  const totalBill = (totalMinutes / 60) * hourlyRate;

  const byDay: Record<string, number> = {};
  for (let d = 0; d < 30; d++) {
    const day = startOfDay(subDays(new Date(), 29 - d));
    byDay[format(day, "yyyy-MM-dd")] = 0;
  }
  entries.forEach((e) => {
    if (!e.end_time) return;
    const start = new Date(e.start_time);
    const end = new Date(e.end_time);
    const key = format(startOfDay(start), "yyyy-MM-dd");
    if (key in byDay) {
      byDay[key] += (end.getTime() - start.getTime()) / (60 * 1000);
    }
  });
  const chartData = Object.entries(byDay).map(([date, minutes]) => ({
    date: format(new Date(date), "MMM d"),
    minutes: Math.round(minutes),
    hours: (minutes / 60).toFixed(1),
  }));

  const byTask: Record<string, number> = {};
  entries.forEach((e) => {
    if (!e.end_time) return;
    const name = e.task_name || "Other";
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    byTask[name] = (byTask[name] ?? 0) + (end - start) / (60 * 1000);
  });
  const taskChartData = Object.entries(byTask)
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  const byTag: Record<string, number> = {};
  const tagById = Object.fromEntries(tagMeta.map((t) => [t.id, t]));
  entries.forEach((e) => {
    if (!e.end_time) return;
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    const mins = (end - start) / (60 * 1000);
    const tagsOnEntry = entryTagLinks
      .filter((l) => l.time_entry_id === e.id)
      .map((l) => tagById[l.tag_id]?.name ?? "—");
    if (tagsOnEntry.length === 0) {
      byTag.Untagged = (byTag.Untagged ?? 0) + mins;
    } else {
      tagsOnEntry.forEach((name) => {
        byTag[name] = (byTag[name] ?? 0) + mins;
      });
    }
  });
  const tagChartData = Object.entries(byTag)
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes);

  function handleEmailBill() {
    const subject = encodeURIComponent(`Invoice: ${project?.name ?? "Project"}`);
    const body = encodeURIComponent(
      `Project: ${project?.name}\nTotal time: ${formatDuration(Math.round(totalMinutes))}\nHourly rate: ${formatCurrency(hourlyRate)}\nTotal amount: ${formatCurrency(totalBill)}\n\nThank you.`
    );
    window.location.href = `mailto:${client?.email ?? ""}?subject=${subject}&body=${body}`;
  }

  function handleDownloadPDF() {
    window.open(`/dashboard/${id}/report/print`, "_blank", "noopener,noreferrer");
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to project
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report: {project.name}</h1>
          <p className="text-muted-foreground">
            {client?.name} • {client?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEmailBill} disabled={!client?.email}>
            <Mail className="mr-2 h-4 w-4" />
            Email bill to client
          </Button>
          <Button className="bg-[#3ECF8E] hover:bg-[#2EB67D]" onClick={handleDownloadPDF}>
            <FileDown className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total time</CardTitle>
            <p className="text-3xl font-semibold text-[#3ECF8E]">
              {formatDuration(Math.round(totalMinutes))}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Amount due</CardTitle>
            <p className="text-3xl font-semibold">
              {formatCurrency(totalBill)}
              {hourlyRate > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  @ {formatCurrency(hourlyRate)}/hr
                </span>
              )}
            </p>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time by day (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}m`} />
                <Tooltip
                  formatter={(value: number) => [formatDuration(value), "Minutes"]}
                  labelFormatter={(_, payload) => payload[0]?.payload?.date}
                />
                <Bar dataKey="minutes" fill="#3ECF8E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time by task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={taskChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={(v) => `${v}m`} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [formatDuration(value), "Minutes"]} />
                <Bar dataKey="minutes" fill="#2EB67D" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {tagChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Time by tag</CardTitle>
            <p className="text-sm text-muted-foreground">
              Overview of time spent per tag for this project.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tagChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `${v}m`} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [formatDuration(value), "Minutes"]} />
                  <Bar dataKey="minutes" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
