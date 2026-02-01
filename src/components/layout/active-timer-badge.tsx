"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Clock, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDurationWithSeconds } from "@/lib/utils";

const DEFAULT_TITLE = "Time Track";

/**
 * Professional behavior: Timer is stored in DB (active_timers). When the user
 * closes the tab, the timer continues (started_at is in the past). When they
 * reopen, we show this badge so they see the timer is still running and can
 * stop it or go to the project.
 */
export function ActiveTimerBadge() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);
  const [timer, setTimer] = useState<{
    id: string;
    project_id: string | null;
    task_id: string | null;
    task_name: string | null;
    started_at: string;
    project?: { name: string };
    tag_ids?: string[];
  } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("active_timers")
        .select("id, project_id, task_id, started_at, task_name, project:projects(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      setTimer(data ?? null);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [supabase]);

  async function stopTimer(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setStopping(true);
    const activeTimer = timer as { tag_ids?: string[] };
    const tagIds = activeTimer.tag_ids ?? [];
    if (timer.project_id) {
      const { data: entry } = await supabase
        .from("time_entries")
        .insert({
          user_id: user.id,
          project_id: timer.project_id,
          task_id: timer.task_id ?? null,
          task_name: timer.task_name ?? null,
          start_time: timer.started_at,
          end_time: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (entry?.id && tagIds.length > 0) {
        await supabase.from("time_entry_tags").insert(
          tagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ["time-entries", timer.project_id] });
    }
    await supabase.from("active_timers").delete().eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
    setTimer(null);
    setStopping(false);
  }

  useEffect(() => {
    if (!timer) {
      setElapsed(0);
      return;
    }
    const start = new Date(timer.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const projectName = (timer as { project?: { name: string } })?.project?.name ?? "Project";
  const timerLabel = timer ? formatDurationWithSeconds(elapsed) : "";
  const savedTitleRef = useRef<string>(DEFAULT_TITLE);

  useEffect(() => {
    if (timer) {
      if (savedTitleRef.current === DEFAULT_TITLE) savedTitleRef.current = document.title;
      document.title = `${timerLabel} • ${projectName} - ${DEFAULT_TITLE}`;
    } else {
      document.title = savedTitleRef.current;
      savedTitleRef.current = DEFAULT_TITLE;
    }
  }, [timer, timerLabel, projectName]);

  useEffect(() => {
    return () => {
      document.title = savedTitleRef.current;
    };
  }, []);

  if (!timer) return null;

  const href = timer.project_id ? `/dashboard/${timer.project_id}` : "/tracker";

  return (
    <div className="flex items-center gap-1 rounded-md bg-[#3ECF8E]/20 ring-1 ring-[#3ECF8E]/30">
      <Link
        href={href}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#2EB67D] transition-colors hover:bg-[#3ECF8E]/20"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ECF8E] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3ECF8E]" />
        </span>
        <Clock className="h-4 w-4" />
        <span className="tabular-nums">{timerLabel}</span>
        <span className="text-muted-foreground">•</span>
        <span className="truncate max-w-[120px]" title={projectName}>
          {projectName}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-2 py-1.5 text-xs font-medium text-[#2EB67D] hover:bg-[#3ECF8E]/30 hover:text-[#2EB67D]"
        onClick={stopTimer}
        disabled={stopping}
        aria-label="Stop timer"
      >
        <Square className="mr-1 h-3 w-3" />
        {stopping ? "Stopping…" : "Stop"}
      </Button>
    </div>
  );
}
