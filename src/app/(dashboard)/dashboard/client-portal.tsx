"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import type { Client } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
};

type TimeEntryRow = {
  id: string;
  project_id: string;
  project_name: string;
  task_name: string | null;
  start_time: string;
  end_time: string | null;
};

function useClientProjects(clientId: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["client-projects", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
  });
}

function useClientTimeEntries(projectIds: string[]) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["client-time-entries", projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data: entries, error } = await supabase
        .from("time_entries")
        .select("id, project_id, task_name, start_time, end_time")
        .in("project_id", projectIds)
        .not("end_time", "is", null)
        .order("start_time", { ascending: false })
        .limit(100);
      if (error) throw error;
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      const nameById = new Map((projects ?? []).map((p) => [p.id, (p as { name: string }).name]));
      return (entries ?? []).map((e) => ({
        ...e,
        project_name: nameById.get(e.project_id) ?? "—",
      })) as TimeEntryRow[];
    },
  });
}

export function ClientPortal({ client }: { client: Client }) {
  const router = useRouter();
  const { data: projects = [], isLoading: projectsLoading } = useClientProjects(client.id);
  const projectIds = projects.map((p) => p.id);
  const { data: timeEntries = [], isLoading: entriesLoading } = useClientTimeEntries(projectIds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your projects</h1>
        <p className="text-muted-foreground">
          View-only access to projects and time entries for {client.name}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <p className="text-sm text-muted-foreground">Projects you have been given access to.</p>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/${project.id}`)}
                  className="flex items-center gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{project.name}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent time entries</CardTitle>
          <p className="text-sm text-muted-foreground">
            Time logged across your projects (read-only).
          </p>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <p className="text-sm text-muted-foreground">Loading time entries…</p>
          ) : timeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => {
                  const start = new Date(entry.start_time);
                  const end = entry.end_time ? new Date(entry.end_time) : null;
                  const mins = end
                    ? Math.round((end.getTime() - start.getTime()) / (60 * 1000))
                    : 0;
                  return (
                    <TableRow key={entry.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{entry.project_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.task_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {start.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {end ? end.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatDuration(mins)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
