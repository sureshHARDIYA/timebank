"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTaskIdentifierWithProject } from "@/lib/utils";
import type { Tag } from "@/types/database";
import type { TaskWithTags } from "./hooks";

const KANBAN_COLUMNS = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To do" },
  { id: "progress", title: "Progress" },
  { id: "done", title: "Done" },
] as const;

export function getTaskStatus(task: TaskWithTags): string {
  return (task as { status?: string }).status ?? (task.completed ? "done" : "todo");
}

export function KanbanBoard({
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

export function KanbanCard({
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
  const taskTags = (task.task_tags ?? []).map((tt) => tt.tags).filter((t): t is Tag => t != null);
  const assignee = task.assignee;
  const identifier = formatTaskIdentifierWithProject(
    (task as { task_number?: number }).task_number,
    projectName
  );

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
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
            <span
              className="text-xs text-muted-foreground"
              title={`Assigned to ${assignee.full_name || assignee.email || "Me"}`}
            >
              {assignee.full_name || assignee.email || "Me"}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
