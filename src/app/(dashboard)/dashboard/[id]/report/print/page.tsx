"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatCurrency } from "@/lib/utils";
import type { TimeEntry, Client } from "@/types/database";
import { format } from "date-fns";

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

export default function PrintReportPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: entries = [], isLoading: entriesLoading } = useTimeEntries(id);

  const totalMinutes = entries.reduce((acc, e) => {
    if (!e.end_time) return acc;
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    return acc + (end - start) / (60 * 1000);
  }, 0);

  const client = project?.clients as Client | undefined;
  const hourlyRate = client?.hourly_rate_usd ?? 0;
  const totalBill = (totalMinutes / 60) * hourlyRate;

  const ready = !projectLoading && !entriesLoading && project;

  useEffect(() => {
    if (ready) window.print();
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Loading report…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8 text-black print:p-8">
      <div className="mb-8 border-b pb-6">
        <h1 className="text-2xl font-bold">Time &amp; Invoice</h1>
        <p className="text-lg text-gray-600">{project.name}</p>
        <p className="mt-2 text-sm text-gray-500">
          Client: {client?.name} ({client?.email})
        </p>
        <p className="text-sm text-gray-500">Generated: {format(new Date(), "PPpp")}</p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-100">
            <th className="px-3 py-2 text-left font-medium">Description</th>
            <th className="px-3 py-2 text-left font-medium">Start</th>
            <th className="px-3 py-2 text-left font-medium">End</th>
            <th className="px-3 py-2 text-right font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const start = new Date(e.start_time);
            const end = e.end_time ? new Date(e.end_time) : null;
            const mins = end ? (end.getTime() - start.getTime()) / (60 * 1000) : 0;
            return (
              <tr key={e.id} className="border-b">
                <td className="px-3 py-2">{e.task_name ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">{format(start, "PPp")}</td>
                <td className="px-3 py-2 text-gray-600">{end ? format(end, "PPp") : "—"}</td>
                <td className="px-3 py-2 text-right">{formatDuration(Math.round(mins))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-8 flex justify-end border-t pt-6">
        <div className="text-right">
          <p className="text-sm text-gray-600">Total time: {formatDuration(Math.round(totalMinutes))}</p>
          {hourlyRate > 0 && (
            <>
              <p className="text-sm text-gray-600">Rate: {formatCurrency(hourlyRate)}/hr</p>
              <p className="mt-2 text-xl font-semibold">Total: {formatCurrency(totalBill)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
