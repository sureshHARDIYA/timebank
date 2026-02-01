"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square } from "lucide-react";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import type { Task, Tag } from "@/types/database";
import { formatDuration } from "@/lib/utils";
import { stopCurrentTimerIfAny } from "@/lib/timer";

function useActiveTimer() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["active-timer"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("active_timers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function TimerWidget({
  projectId,
  projectName,
  tasks,
  tags,
  onStop,
}: {
  projectId: string;
  projectName: string;
  tasks: Task[];
  tags: Tag[];
  onStop: () => void;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: activeTimer, isLoading } = useActiveTimer();
  const [taskId, setTaskId] = useState<string>("");
  const [taskName, setTaskName] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const isThisProject = activeTimer?.project_id === projectId;

  useEffect(() => {
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId) as { task_tags?: { tag_id: string }[] } | undefined;
      setSelectedTagIds(task?.task_tags?.map((tt) => tt.tag_id) ?? []);
    } else {
      setSelectedTagIds([]);
    }
  }, [taskId, tasks]);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await stopCurrentTimerIfAny(supabase, queryClient);
    await supabase.from("active_timers").upsert(
      {
        user_id: user.id,
        project_id: projectId,
        task_id: taskId || null,
        task_name: taskName.trim() || null,
        started_at: new Date().toISOString(),
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : [],
      },
      { onConflict: "user_id" }
    );
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
  }

  async function stopTimer() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activeTimer) return;
    const tagIds = (activeTimer as { tag_ids?: string[] }).tag_ids ?? [];
    const { data: entry, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        project_id: activeTimer.project_id!,
        task_id: activeTimer.task_id,
        task_name: activeTimer.task_name,
        start_time: activeTimer.started_at,
        end_time: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (!error && entry?.id && tagIds.length > 0) {
      await supabase.from("time_entry_tags").insert(
        tagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id }))
      );
    }
    await supabase.from("active_timers").delete().eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
    onStop();
  }

  if (isLoading) return null;

  if (activeTimer && !isThisProject) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Timer is running on another project. Stop it from the Time Tracker page or from that project.
      </div>
    );
  }

  if (activeTimer && isThisProject) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {formatDuration(Math.floor(elapsed / 60))}
          </span>
          <Button variant="destructive" size="sm" onClick={stopTimer}>
            <Square className="mr-1 h-4 w-4" />
            Stop
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {activeTimer.task_name || tasks.find((t) => t.id === activeTimer.task_id)?.name || "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <Label>Start timer</Label>
      <div className="flex flex-wrap gap-2">
        <Select value={taskId || "__none__"} onValueChange={(v) => setTaskId(v === "__none__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Task (optional)" />
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
        <Input
          placeholder="Or type task name"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          className="max-w-[200px]"
        />
        <Button onClick={startTimer} className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
          <Play className="mr-1 h-4 w-4" />
          Start
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Tags (optional)</Label>
          <TagMultiSelect
            tags={tags}
            selectedIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        </div>
      )}
    </div>
  );
}
