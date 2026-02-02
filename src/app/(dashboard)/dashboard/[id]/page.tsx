"use client";

import { Button } from "@/components/ui/button";
import { useTags } from "@/hooks/use-tags";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { stopCurrentTimerIfAny } from "@/lib/timer";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AddTaskButton } from "./add-task-button";
import { EditTimeEntryDialog } from "./edit-time-entry-dialog";
import {
  type TaskWithTags,
  type TimeEntryWithTags,
  useProject,
  useProjectTasks,
  useProjectTimeEntries,
} from "./hooks";
import { KanbanBoard } from "./kanban-board";
import { ProjectDetailHeader } from "./project-detail-header";
import { ProjectTimeEntriesCard } from "./project-time-entries-card";
import { TaskDetailModal } from "./task-detail-modal";

export type { TaskWithTags } from "./hooks";
export type { TimeEntryWithTags } from "./hooks";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: user } = useUser();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { data: project, isLoading } = useProject(id);
  const { data: tasks = [] } = useProjectTasks(id, tagsLoading ? undefined : (tags ?? []));
  const { data: timeEntries = [] } = useProjectTimeEntries(
    id,
    tagsLoading ? undefined : (tags ?? [])
  );
  const tagsList = tags ?? [];
  const [editingEntry, setEditingEntry] = useState<TimeEntryWithTags | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithTags | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  async function startTimerForTask(taskId: string, taskName: string) {
    if (!user) return;
    const task = tasks.find((t) => t.id === taskId);
    const tagIds = (task as TaskWithTags)?.task_tags?.map((tt) => tt.tag_id) ?? [];
    await stopCurrentTimerIfAny(supabase, queryClient, user?.id);
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
      <ProjectDetailHeader projectName={project.name} client={client} projectId={id} />
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
          <AddTaskButton
            projectId={id}
            tags={tagsList}
            onAdded={() => queryClient.invalidateQueries({ queryKey: ["tasks", id] })}
          />
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
        tags={tagsList}
        projectTimeEntries={timeEntries}
        open={taskModalOpen}
        onStartTimer={startTimerForTask}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["tasks", id] })}
        onClose={() => {
          setSelectedTask(null);
          setTaskModalOpen(false);
        }}
      />

      <ProjectTimeEntriesCard
        entries={timeEntries}
        tasks={tasks}
        onEdit={(entry) => {
          setEditingEntry(entry);
          setEditDialogOpen(true);
        }}
        onDelete={async (entry) => {
          if (!confirm("Delete this time entry? This cannot be undone.")) return;
          await supabase.from("time_entries").delete().eq("id", entry.id);
          queryClient.invalidateQueries({ queryKey: ["time-entries", id] });
        }}
      />

      <EditTimeEntryDialog
        entry={editingEntry}
        tasks={tasks}
        tags={tagsList}
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
