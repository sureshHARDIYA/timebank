"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { stopCurrentTimerIfAny } from "@/lib/timer";
import { formatDuration } from "@/lib/utils";
import type { Task } from "@/types/database";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function useProjects() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
}

function useProjectTasks(projectId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name")
        .eq("project_id", projectId!)
        .order("name");
      if (error) throw error;
      return data as Task[];
    },
  });
}

function useActiveTimer() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["active-timer"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("active_timers")
        .select("*, project:projects(id, name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export default function TrackerPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useProjectTasks(projectId || null);
  const { data: activeTimer, isLoading } = useActiveTimer();

  useEffect(() => {
    if (!activeTimer) {
      setElapsed(0);
      return;
    }
    const start = new Date(activeTimer.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  async function startTimer() {
    if (!projectId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await stopCurrentTimerIfAny(supabase, queryClient);
    await supabase.from("active_timers").upsert(
      {
        user_id: user.id,
        project_id: projectId,
        task_id: taskId || null,
        task_name: taskName.trim() || null,
        started_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
  }

  async function stopTimer() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !activeTimer) return;
    await supabase.from("time_entries").insert({
      user_id: user.id,
      project_id: activeTimer.project_id!,
      task_id: activeTimer.task_id,
      task_name: activeTimer.task_name,
      start_time: activeTimer.started_at,
      end_time: new Date().toISOString(),
    });
    await supabase.from("active_timers").delete().eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
  }

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Time Tracker</h1>
      <p className="text-muted-foreground">
        Select a project and optional task, then start the timer. Stop when done.
      </p>

      {activeTimer ? (
        <Card className="border-2 border-[#3ECF8E]/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-[#3ECF8E] animate-pulse" />
              Timer running
            </CardTitle>
            <Button variant="destructive" onClick={stopTimer}>
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {formatDuration(Math.floor(elapsed / 60))}
            </div>
            <p className="text-sm text-muted-foreground">
              Project:{" "}
              <Link
                href={`/dashboard/${activeTimer.project_id}`}
                className="text-[#3ECF8E] hover:underline"
              >
                {(activeTimer as { project?: { name: string } })?.project?.name ?? "—"}
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Task:{" "}
              {activeTimer.task_name ||
                tasks.find((t) => t.id === activeTimer.task_id)?.name ||
                "—"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Start timer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={(v) => setProjectId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Task (optional)</Label>
                <Select
                  value={taskId || "__none__"}
                  onValueChange={(v) => setTaskId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Or task name (ad-hoc)</Label>
              <Input
                placeholder="e.g. Design review"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
            </div>
            <Button
              className="mt-4 bg-[#3ECF8E] hover:bg-[#2EB67D]"
              onClick={startTimer}
              disabled={!projectId}
            >
              <Play className="mr-2 h-4 w-4" />
              Start timer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
