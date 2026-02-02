"use client";

import { createClient } from "@/lib/supabase/client";
import type { Client, Project, Tag, Task, TimeEntry } from "@/types/database";
import { useQuery } from "@tanstack/react-query";

export type TaskWithTags = Task & {
  task_tags?: { tag_id: string; tags: Tag | null }[];
  assignee?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

export type TimeEntryWithTags = TimeEntry & { entryTags: Tag[] };

const STALE_TIME_MS = 60 * 1000;

export function useProject(id: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Project & { clients: Client };
    },
  });
}

export function useProjectTasks(projectId: string | null, userTags: Tag[] | undefined) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["tasks", projectId],
    enabled: !!projectId && userTags !== undefined,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (tasksError) throw tasksError;
      if (!tasks?.length) return [] as TaskWithTags[];

      const taskIds = tasks.map((t) => t.id);
      let taskTagRows: { task_id: string; tag_id: string }[] = [];
      const { data: ttData, error: ttError } = await supabase
        .from("task_tags")
        .select("task_id, tag_id")
        .in("task_id", taskIds);
      if (!ttError) taskTagRows = ttData ?? [];

      const tagIds = Array.from(new Set(taskTagRows.map((r) => r.tag_id)));
      const tagMap = new Map<string, Tag>();
      if (userTags?.length && tagIds.length > 0) {
        for (const t of userTags) {
          if (tagIds.includes(t.id)) tagMap.set(t.id, t);
        }
      }

      const ttByTask = new Map<string, { tag_id: string; tags: Tag | null }[]>();
      for (const r of taskTagRows) {
        const list = ttByTask.get(r.task_id) ?? [];
        list.push({ tag_id: r.tag_id, tags: tagMap.get(r.tag_id) ?? null });
        ttByTask.set(r.task_id, list);
      }

      const assigneeIds = Array.from(
        new Set(
          tasks.map((t) => (t as { assignee_id?: string }).assignee_id).filter(Boolean) as string[]
        )
      );
      const assigneeMap = new Map<
        string,
        { id: string; full_name: string | null; email: string | null }
      >();
      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assigneeIds);
        for (const p of profiles ?? []) {
          assigneeMap.set(p.id, p);
        }
      }

      return tasks.map((t) => ({
        ...t,
        task_tags: ttByTask.get(t.id) ?? [],
        assignee: (t as { assignee_id?: string }).assignee_id
          ? (assigneeMap.get((t as { assignee_id: string }).assignee_id) ?? null)
          : null,
      })) as TaskWithTags[];
    },
  });
}

export function useProjectTimeEntries(projectId: string | null, userTags: Tag[] | undefined) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["time-entries", projectId],
    enabled: !!projectId && userTags !== undefined,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("project_id", projectId!)
        .order("start_time", { ascending: false });
      if (error) throw error;
      const list = (entries ?? []) as TimeEntry[];
      if (list.length === 0) return [] as TimeEntryWithTags[];
      const entryIds = list.map((e) => e.id);
      const { data: links } = await supabase
        .from("time_entry_tags")
        .select("time_entry_id, tag_id")
        .in("time_entry_id", entryIds);
      const tagIds = Array.from(new Set((links ?? []).map((l: { tag_id: string }) => l.tag_id)));
      const tagMap = new Map<string, Tag>();
      if (userTags?.length && tagIds.length > 0) {
        for (const t of userTags) {
          if (tagIds.includes(t.id)) tagMap.set(t.id, t);
        }
      }
      const entryTagsMap = new Map<string, Tag[]>();
      for (const l of links ?? []) {
        const link = l as { time_entry_id: string; tag_id: string };
        const tag = tagMap.get(link.tag_id);
        if (!tag) continue;
        const arr = entryTagsMap.get(link.time_entry_id) ?? [];
        arr.push(tag);
        entryTagsMap.set(link.time_entry_id, arr);
      }
      return list.map((e) => ({
        ...e,
        entryTags: entryTagsMap.get(e.id) ?? [],
      })) as TimeEntryWithTags[];
    },
  });
}
