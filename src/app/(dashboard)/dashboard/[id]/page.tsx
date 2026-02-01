"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Plus, ListTodo, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatDuration, formatTaskIdentifierWithProject } from "@/lib/utils";
import { stopCurrentTimerIfAny } from "@/lib/timer";
import type { Project, Task, TimeEntry, Client, Tag } from "@/types/database";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import { EditTimeEntryDialog } from "./edit-time-entry-dialog";
import { TaskDetailModal } from "./task-detail-modal";


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
      return data as Project & { clients: Client };
    },
  });
}

export type TaskWithTags = Task & {
  task_tags?: { tag_id: string; tags: Tag | null }[];
  assignee?: { id: string; full_name: string | null; email: string | null } | null;
};

function useProjectTasks(projectId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["tasks", projectId],
    enabled: !!projectId,
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
      // PGRST205 = table not in schema cache (migration not run); treat as no tags
      if (!ttError) taskTagRows = ttData ?? [];

      const tagIds = Array.from(new Set(taskTagRows.map((r) => r.tag_id)));
      const tagMap = new Map<string, Tag>();
      if (tagIds.length > 0) {
        const { data: tagRows } = await supabase
          .from("tags")
          .select("*")
          .in("id", tagIds);
        (tagRows ?? []).forEach((t) => tagMap.set(t.id, t as Tag));
      }

      const ttByTask = new Map<string, { tag_id: string; tags: Tag | null }[]>();
      taskTagRows.forEach((r) => {
        const list = ttByTask.get(r.task_id) ?? [];
        list.push({ tag_id: r.tag_id, tags: tagMap.get(r.tag_id) ?? null });
        ttByTask.set(r.task_id, list);
      });

      const assigneeIds = Array.from(
        new Set(
          tasks
            .map((t) => (t as { assignee_id?: string }).assignee_id)
            .filter(Boolean) as string[]
        )
      );
      const assigneeMap = new Map<string, { id: string; full_name: string | null; email: string | null }>();
      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assigneeIds);
        (profiles ?? []).forEach((p) => assigneeMap.set(p.id, p));
      }

      return tasks.map((t) => ({
        ...t,
        task_tags: ttByTask.get(t.id) ?? [],
        assignee: (t as { assignee_id?: string }).assignee_id
          ? assigneeMap.get((t as { assignee_id: string }).assignee_id) ?? null
          : null,
      })) as TaskWithTags[];
    },
  });
}

export type TimeEntryWithTags = TimeEntry & { entryTags: Tag[] };

function useProjectTimeEntries(projectId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["time-entries", projectId],
    enabled: !!projectId,
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
      if (tagIds.length > 0) {
        const { data: tagRows } = await supabase.from("tags").select("*").in("id", tagIds);
        (tagRows ?? []).forEach((t) => tagMap.set(t.id, t as Tag));
      }
      const entryTagsMap = new Map<string, Tag[]>();
      (links ?? []).forEach((l: { time_entry_id: string; tag_id: string }) => {
        const tag = tagMap.get(l.tag_id);
        if (!tag) return;
        const arr = entryTagsMap.get(l.time_entry_id) ?? [];
        arr.push(tag);
        entryTagsMap.set(l.time_entry_id, arr);
      });
      return list.map((e) => ({
        ...e,
        entryTags: entryTagsMap.get(e.id) ?? [],
      })) as TimeEntryWithTags[];
    },
  });
}

function useUserTags() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data as import("@/types/database").Tag[];
    },
  });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: project, isLoading } = useProject(id);
  const { data: tasks = [] } = useProjectTasks(id);
  const { data: timeEntries = [] } = useProjectTimeEntries(id);
  const { data: tags = [] } = useUserTags();
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithTags | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [timeEntrySort, setTimeEntrySort] = useState<{
    key: "task" | "start" | "end" | "duration";
    dir: "asc" | "desc";
  }>({ key: "start", dir: "desc" });

  const sortedTimeEntries: TimeEntryWithTags[] = [...timeEntries]
    .sort((a, b) => {
      const aStart = new Date(a.start_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const aEnd = a.end_time ? new Date(a.end_time).getTime() : 0;
      const bEnd = b.end_time ? new Date(b.end_time).getTime() : 0;
      const aMins = aEnd ? (aEnd - aStart) / (60 * 1000) : 0;
      const bMins = bEnd ? (bEnd - bStart) / (60 * 1000) : 0;
      const aDesc = a.task_name ?? tasks.find((t) => t.id === a.task_id)?.name ?? "";
      const bDesc = b.task_name ?? tasks.find((t) => t.id === b.task_id)?.name ?? "";
      let cmp = 0;
      switch (timeEntrySort.key) {
        case "task":
          cmp = aDesc.localeCompare(bDesc);
          break;
        case "start":
          cmp = aStart - bStart;
          break;
        case "end":
          cmp = (aEnd || 0) - (bEnd || 0);
          break;
        case "duration":
          cmp = aMins - bMins;
          break;
      }
      return timeEntrySort.dir === "asc" ? cmp : -cmp;
    })
    .slice(0, 20);

  function toggleTimeEntrySort(key: "task" | "start" | "end" | "duration") {
    setTimeEntrySort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  async function startTimerForTask(taskId: string, taskName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const task = tasks.find((t) => t.id === taskId);
    const tagIds = (task as TaskWithTags)?.task_tags?.map((tt) => tt.tag_id) ?? [];
    await stopCurrentTimerIfAny(supabase, queryClient);
    await supabase.from("active_timers").upsert(
      {
        user_id: user.id,
        project_id: id,
        task_id: taskId,
        task_name: taskName,
        started_at: new Date().toISOString(),
        tag_ids: tagIds,
      },
      { onConflict: "user_id" }
    );
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
  }

  const client = project?.clients;

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">
            {client?.name} • {client?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#3ECF8E]/20 px-2 py-1 text-xs font-medium text-[#2EB67D]">
            ACTIVE
          </span>
          <Button asChild className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
            <Link href={`/dashboard/${id}/report`}>
              View report & billing
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Kanban</h2>
            <Link
              href="/tags"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Manage tags
            </Link>
          </div>
          <AddTaskButton projectId={id} tags={tags} onAdded={() => queryClient.invalidateQueries({ queryKey: ["tasks", id] })} />
        </div>
        <KanbanBoard
          tasks={tasks}
          projectName={project.name}
          onTaskClick={(task) => {
            setSelectedTask(task);
            setTaskModalOpen(true);
          }}
          onMoveTask={async (taskId, newStatus) => {
            await supabase
              .from("tasks")
              .update({
                status: newStatus as "backlog" | "todo" | "progress" | "done",
                completed: newStatus === "done",
              })
              .eq("id", taskId);
            queryClient.invalidateQueries({ queryKey: ["tasks", id] });
          }}
        />
      </div>

      <TaskDetailModal
        task={selectedTask}
        projectId={id}
        projectName={project.name}
        tags={tags}
        open={taskModalOpen}
        onStartTimer={startTimerForTask}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["tasks", id] })}
        onClose={() => {
          setSelectedTask(null);
          setTaskModalOpen(false);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent time entries</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use the menu on each row to edit or delete. Start a timer from a task card or add time from the calendar.
          </p>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-8 font-medium"
                      onClick={() => toggleTimeEntrySort("task")}
                    >
                      Task / Description
                      {timeEntrySort.key === "task" ? (
                        timeEntrySort.dir === "asc" ? (
                          <ArrowUp className="ml-1.5 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-1.5 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-8 font-medium"
                      onClick={() => toggleTimeEntrySort("start")}
                    >
                      Start
                      {timeEntrySort.key === "start" ? (
                        timeEntrySort.dir === "asc" ? (
                          <ArrowUp className="ml-1.5 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-1.5 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-8 font-medium"
                      onClick={() => toggleTimeEntrySort("end")}
                    >
                      End
                      {timeEntrySort.key === "end" ? (
                        timeEntrySort.dir === "asc" ? (
                          <ArrowUp className="ml-1.5 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-1.5 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-8 font-medium"
                      onClick={() => toggleTimeEntrySort("duration")}
                    >
                      Duration
                      {timeEntrySort.key === "duration" ? (
                        timeEntrySort.dir === "asc" ? (
                          <ArrowUp className="ml-1.5 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-1.5 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[140px]">Tags</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTimeEntries.map((entry) => (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    entryTags={entry.entryTags ?? []}
                    tasks={tasks}
                    formatDuration={formatDuration}
                    onEdit={() => {
                      setEditingEntry(entry);
                      setEditDialogOpen(true);
                    }}
                    onDelete={async () => {
                      if (!confirm("Delete this time entry? This cannot be undone.")) return;
                      await supabase.from("time_entries").delete().eq("id", entry.id);
                      queryClient.invalidateQueries({ queryKey: ["time-entries", id] });
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditTimeEntryDialog
        entry={editingEntry}
        tasks={tasks}
        tags={tags}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingEntry(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["time-entries", id] })}
      />
    </div>
  );
}

const KANBAN_COLUMNS = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To do" },
  { id: "progress", title: "Progress" },
  { id: "done", title: "Done" },
] as const;

function getTaskStatus(task: TaskWithTags): string {
  return (task as { status?: string }).status ?? (task.completed ? "done" : "todo");
}

function KanbanBoard({
  tasks,
  projectName,
  onTaskClick,
  onMoveTask,
}: {
  tasks: TaskWithTags[];
  projectName: string;
  onTaskClick: (task: TaskWithTags) => void;
  onMoveTask: (taskId: string, newStatus: string) => void | Promise<void>;
}) {
  const tasksByStatus = tasks.reduce<Record<string, TaskWithTags[]>>((acc, task) => {
    const status = getTaskStatus(task);
    if (!acc[status]) acc[status] = [];
    acc[status].push(task);
    return acc;
  }, {});

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetStatus: string) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("application/x-task-id");
    if (taskId && targetStatus) onMoveTask(taskId, targetStatus);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KANBAN_COLUMNS.map((col) => {
        const columnTasks = tasksByStatus[col.id] ?? [];
        return (
          <Card
            key={col.id}
            className="flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {col.title}
              </CardTitle>
            </CardHeader>
            <CardContent
              className="flex-1 space-y-2 overflow-auto min-h-[120px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {columnTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center rounded border-2 border-dashed border-muted-foreground/20">
                  Drop here
                </p>
              ) : (
                columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    projectName={projectName}
                    onClick={() => onTaskClick(task)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-task-id", task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  projectName,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  task: TaskWithTags;
  projectName: string;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const taskTags = (task.task_tags ?? [])
    .map((tt) => tt.tags)
    .filter((t): t is Tag => t != null);
  const assignee = task.assignee;
  const identifier = formatTaskIdentifierWithProject(
    (task as { task_number?: number }).task_number,
    projectName
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="w-full cursor-grab active:cursor-grabbing rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/50 hover:border-[#3ECF8E]/50"
    >
      <span className="text-xs font-medium text-muted-foreground">{identifier}</span>
      <span className="mt-0.5 block font-medium">{task.name}</span>
      {(taskTags.length > 0 || assignee) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex rounded-full border border-transparent px-1.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: tag.color ? `${tag.color}33` : undefined,
                color: tag.color || undefined,
              }}
            >
              {tag.name}
            </span>
          ))}
          {assignee && (
            <span className="text-xs text-muted-foreground" title={`Assigned to ${assignee.full_name || assignee.email || "Me"}`}>
              {assignee.full_name || assignee.email || "Me"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TimeEntryRow({
  entry,
  entryTags,
  tasks,
  formatDuration,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  entryTags: Tag[];
  tasks: Task[];
  formatDuration: (mins: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = new Date(entry.start_time);
  const end = entry.end_time ? new Date(entry.end_time) : null;
  const mins = end ? (end.getTime() - start.getTime()) / (60 * 1000) : 0;
  const description = entry.task_name ?? (tasks.find((t) => t.id === entry.task_id)?.name ?? "—");

  return (
    <TableRow>
      <TableCell className="font-medium">{description}</TableCell>
      <TableCell className="text-muted-foreground">{start.toLocaleString()}</TableCell>
      <TableCell className="text-muted-foreground">
        {end ? end.toLocaleString() : "—"}
      </TableCell>
      <TableCell>{formatDuration(Math.round(mins))}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {entryTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex rounded-full border border-transparent px-1.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: tag.color ? `${tag.color}33` : undefined,
                color: tag.color || undefined,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function AddTaskButton({
  projectId,
  tags,
  onAdded,
}: {
  projectId: string;
  tags: Tag[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const supabase = createClient();

  async function addTask() {
    if (!name.trim()) return;
    const { data: maxRow } = await supabase
      .from("tasks")
      .select("task_number")
      .eq("project_id", projectId)
      .order("task_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (maxRow?.task_number ?? 0) + 1;
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({ project_id: projectId, name: name.trim(), status: "backlog", task_number: nextNumber })
      .select("id")
      .single();
    if (error) return;
    if (task?.id && selectedTagIds.length > 0) {
      await supabase.from("task_tags").insert(
        selectedTagIds.map((tag_id) => ({ task_id: task.id, tag_id }))
      );
    }
    setName("");
    setSelectedTagIds([]);
    setOpen(false);
    onAdded();
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Add task
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Add a task (todo) to this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task name</Label>
              <Input
                placeholder="e.g. Design homepage"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
            </div>
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags (optional)</Label>
                <TagMultiSelect
                  tags={tags}
                  selectedIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={addTask} className="bg-[#3ECF8E] hover:bg-[#2EB67D]">Add</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskRow({
  task,
  onUpdated,
}: {
  task: TaskWithTags;
  onUpdated: () => void;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(task.name);
  const taskTags = (task.task_tags ?? [])
    .map((tt) => tt.tags)
    .filter((t): t is Tag => t != null);

  async function toggleComplete() {
    await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id);
    onUpdated();
  }

  async function saveName() {
    if (name.trim() && name !== task.name) {
      await supabase.from("tasks").update({ name: name.trim() }).eq("id", task.id);
      onUpdated();
    }
    setEditing(false);
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={toggleComplete}
        className="h-4 w-4 shrink-0 rounded border-gray-300"
      />
      {editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="h-8 flex-1 min-w-0"
        />
      ) : (
        <span
          className={`min-w-0 flex-1 cursor-pointer text-sm ${task.completed ? "text-muted-foreground line-through" : ""}`}
          onClick={() => setEditing(true)}
        >
          {task.name}
        </span>
      )}
      {taskTags.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: tag.color ? `${tag.color}33` : undefined,
                color: tag.color || undefined,
              }}
            >
              {tag.name}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}
