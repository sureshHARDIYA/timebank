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
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function useClients() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as { id: string; name: string; email: string | null; hourly_rate_usd: number }[];
    },
  });
}

type ProjectWithTime = {
  id: string;
  name: string;
  minutes: number;
  amount: number;
};

function useAllProjectsWithTime(enabled: boolean) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["all-projects-with-time"],
    enabled,
    queryFn: async (): Promise<ProjectWithTime[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: projects, error: projError } = await supabase
        .from("projects")
        .select("id, name, client_id, clients(id, name, email, hourly_rate_usd)")
        .eq("user_id", user.id);
      if (projError) throw projError;
      const { data: entries, error: entError } = await supabase
        .from("time_entries")
        .select("project_id, start_time, end_time")
        .eq("user_id", user.id)
        .not("end_time", "is", null);
      if (entError) throw entError;

      const byProject: Record<
        string,
        { minutes: number; project: (typeof projects)[0]; client: { hourly_rate_usd: number } }
      > = {};
      const getClient = (p: (typeof projects)[0]): { hourly_rate_usd: number } => {
        const c = (
          p as unknown as {
            clients?: { hourly_rate_usd: number } | { hourly_rate_usd: number }[] | null;
          }
        ).clients;
        if (Array.isArray(c)) return c[0] ?? { hourly_rate_usd: 0 };
        return c ?? { hourly_rate_usd: 0 };
      };
      for (const p of projects ?? []) {
        byProject[p.id] = {
          minutes: 0,
          project: p,
          client: getClient(p),
        };
      }
      for (const e of entries ?? []) {
        if (!e.end_time || !byProject[e.project_id]) continue;
        const start = new Date(e.start_time).getTime();
        const end = new Date(e.end_time).getTime();
        byProject[e.project_id].minutes += (end - start) / (60 * 1000);
      }

      return Object.entries(byProject)
        .map(([id, { minutes, project, client }]) => ({
          id,
          name: project.name,
          minutes,
          amount: (minutes / 60) * (client?.hourly_rate_usd ?? 0),
        }))
        .filter((p) => p.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
    },
  });
}

function useClientProjectsWithTime(clientId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["client-projects-with-time", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ProjectWithTime[]> => {
      if (!clientId) return [];
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: projects, error: projError } = await supabase
        .from("projects")
        .select("id, name, client_id, clients(id, name, email, hourly_rate_usd)")
        .eq("user_id", user.id)
        .eq("client_id", clientId);
      if (projError) throw projError;
      const { data: entries, error: entError } = await supabase
        .from("time_entries")
        .select("project_id, start_time, end_time")
        .eq("user_id", user.id)
        .not("end_time", "is", null);
      if (entError) throw entError;

      const byProject: Record<
        string,
        { minutes: number; project: (typeof projects)[0]; client: { hourly_rate_usd: number } }
      > = {};
      const getClient = (p: (typeof projects)[0]): { hourly_rate_usd: number } => {
        const c = (
          p as unknown as {
            clients?: { hourly_rate_usd: number } | { hourly_rate_usd: number }[] | null;
          }
        ).clients;
        if (Array.isArray(c)) return c[0] ?? { hourly_rate_usd: 0 };
        return c ?? { hourly_rate_usd: 0 };
      };
      for (const p of projects ?? []) {
        byProject[p.id] = {
          minutes: 0,
          project: p,
          client: getClient(p),
        };
      }
      for (const e of entries ?? []) {
        if (!e.end_time || !byProject[e.project_id]) continue;
        const start = new Date(e.start_time).getTime();
        const end = new Date(e.end_time).getTime();
        byProject[e.project_id].minutes += (end - start) / (60 * 1000);
      }

      return Object.entries(byProject)
        .map(([id, { minutes, project, client }]) => ({
          id,
          name: project.name,
          minutes,
          amount: (minutes / 60) * (client?.hourly_rate_usd ?? 0),
        }))
        .filter((p) => p.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
    },
  });
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const clientFromUrl = searchParams.get("client");
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  const { data: allProjects = [], isLoading: allProjectsLoading } = useAllProjectsWithTime(
    !clientId
  );
  const { data: clientProjects = [], isLoading: clientProjectsLoading } = useClientProjectsWithTime(
    clientId || null
  );

  const projects = clientId ? clientProjects : allProjects;
  const projectsLoading = clientId ? clientProjectsLoading : allProjectsLoading;

  useEffect(() => {
    if (clients.length === 0) return;
    if (clientFromUrl && clients.some((c) => c.id === clientFromUrl)) {
      setClientId(clientFromUrl);
    }
  }, [clients, clientFromUrl]);

  useEffect(() => {
    if (clientId) setProjectId("");
  }, [clientId]);

  const displayProjects = projectId ? projects.filter((p) => p.id === projectId) : projects;

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
      <p className="text-muted-foreground">
        View time and billing by client. Select a client, then choose which project to see (or all
        projects).
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select
            value={clientId || "__all__"}
            onValueChange={(v) => setClientId(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` (${c.email})` : ""}
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
            <SelectTrigger className="w-[220px]">
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
      </div>

      {clientsLoading || projectsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-2/3 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : displayProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              {clientId
                ? `${selectedClient?.name ?? "This client"} has no projects with time tracked yet.`
                : "No time tracked yet."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Track time on projects from the dashboard, then return here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayProjects.map((p) => (
            <Link key={p.id} href={`/dashboard/${p.id}/report`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#3ECF8E] font-medium">
                    {formatDuration(Math.round(p.minutes))}
                  </p>
                  {p.amount > 0 && (
                    <p className="text-xs text-muted-foreground">{formatCurrency(p.amount)}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-96 rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 w-2/3 rounded bg-muted" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
