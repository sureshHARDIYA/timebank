"use client";

import { Button } from "@/components/ui/button";
import { useActiveTimer } from "@/hooks/use-active-timer";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { formatDurationWithSeconds } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const { data: user } = useUser();
  const { data: activeTimerRow } = useActiveTimer();
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);

  const timer = useMemo(
    () =>
      activeTimerRow
        ? {
            id: activeTimerRow.id,
            project_id: activeTimerRow.project_id,
            task_id: activeTimerRow.task_id,
            task_name: activeTimerRow.task_name,
            started_at: activeTimerRow.started_at,
            project: Array.isArray(activeTimerRow.project)
              ? activeTimerRow.project[0]
              : activeTimerRow.project,
            tag_ids: (activeTimerRow as { tag_ids?: string[] }).tag_ids,
          }
        : null,
    [activeTimerRow]
  );

  async function stopTimer(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!timer || !user) return;
    setStopping(true);
    const tagIds = timer.tag_ids ?? [];
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
          source: "automatic",
        })
        .select("id")
        .single();
      if (entry?.id && tagIds.length > 0) {
        await supabase
          .from("time_entry_tags")
          .insert(tagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id })));
      }
      queryClient.invalidateQueries({ queryKey: ["time-entries", timer.project_id] });
    }
    await supabase.from("active_timers").delete().eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
    setStopping(false);
  }

  useEffect(() => {
    if (!timer) {
      queueMicrotask(() => setElapsed(0));
      return;
    }
    const start = new Date(timer.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    queueMicrotask(() => tick());
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const projectName = timer?.project?.name ?? "Project";
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
