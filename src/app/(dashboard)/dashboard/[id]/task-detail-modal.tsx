"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, Plus } from "lucide-react";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import { formatTaskIdentifierWithProject, formatDuration } from "@/lib/utils";
import type { Tag } from "@/types/database";
import type { TimeEntry } from "@/types/database";
import type { TaskWithTags } from "./page";

const KANBAN_STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "progress", label: "Progress" },
  { value: "done", label: "Done" },
] as const;

export function TaskDetailModal({
  task,
  projectId,
  projectName,
  tags,
  onStartTimer,
  onUpdated,
  onClose,
  open,
}: {
  task: TaskWithTags | null;
  projectId: string;
  projectName: string;
  tags: Tag[];
  onStartTimer: (taskId: string, taskName: string) => void;
  onUpdated: () => void;
  onClose: () => void;
  open: boolean;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<string>(task?.status ?? "backlog");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddTime, setShowAddTime] = useState(false);
  const [addTimeStart, setAddTimeStart] = useState("");
  const [addTimeEnd, setAddTimeEnd] = useState("");
  const [addingTime, setAddingTime] = useState(false);

  const { data: taskTimeEntries = [] } = useQuery({
    queryKey: ["time-entries-by-task", projectId, task?.id],
    enabled: !!projectId && !!task?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("project_id", projectId)
        .eq("task_id", task!.id)
        .order("start_time", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
  });

  useEffect(() => {
    if (task && open) {
      setName(task.name);
      setDescription(task.description ?? "");
      setStatus((task as { status?: string }).status ?? (task.completed ? "done" : "todo"));
      setSelectedTagIds((task.task_tags ?? []).map((tt) => tt.tag_id));
      setShowAddTime(false);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      setAddTimeStart(oneHourAgo.toISOString().slice(0, 16));
      setAddTimeEnd(now.toISOString().slice(0, 16));
    }
  }, [task?.id, open]);

  const effectiveStatus = (task?.status ?? (task?.completed ? "done" : "todo")) as string;
  const currentStatus = status || effectiveStatus;

  async function save() {
    if (!task) return;
    setSaving(true);
    await supabase
      .from("tasks")
      .update({
        name: name.trim() || task.name,
        description: description.trim() || null,
        status: currentStatus as "backlog" | "todo" | "progress" | "done",
        completed: currentStatus === "done",
      })
      .eq("id", task.id);
    try {
      await supabase.from("task_tags").delete().eq("task_id", task.id);
      if (selectedTagIds.length > 0) {
        await supabase.from("task_tags").insert(
          selectedTagIds.map((tag_id) => ({ task_id: task.id, tag_id }))
        );
      }
    } catch {
      // task_tags table may not exist yet (migration not run)
    }
    setSaving(false);
    onUpdated();
  }

  function handleStartTimer() {
    if (!task) return;
    onStartTimer(task.id, task.name);
    onClose();
  }

  async function handleAddManualTime() {
    if (!task) return;
    const start = new Date(addTimeStart);
    const end = new Date(addTimeEnd);
    if (end <= start) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAddingTime(true);
    const { data: entry, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        project_id: projectId,
        task_id: task.id,
        task_name: task.name,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      })
      .select("id")
      .single();
    if (!error && entry?.id && selectedTagIds.length > 0) {
      await supabase.from("time_entry_tags").insert(
        selectedTagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id }))
      );
    }
    setAddingTime(false);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["time-entries", projectId] });
      queryClient.invalidateQueries({ queryKey: ["time-entries-by-task", projectId, task.id] });
      onUpdated();
      setShowAddTime(false);
      setAddTimeStart(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
      setAddTimeEnd(new Date().toISOString().slice(0, 16));
    }
  }

  if (!task) return null;

  const taskTags = (task.task_tags ?? [])
    .map((tt) => tt.tags)
    .filter((t): t is Tag => t != null);
  const taskNumber = (task as { task_number?: number }).task_number;
  const identifier = formatTaskIdentifierWithProject(taskNumber, projectName);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <div className="relative">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-medium">{identifier}</DialogTitle>
              <Button
                onClick={handleStartTimer}
                className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
              >
                <Play className="mr-2 h-4 w-4" />
                Start timer
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={save}
              placeholder="Task name"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={save}
              placeholder="Optional description"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={currentStatus}
              onValueChange={(v) => {
                setStatus(v);
                supabase
                  .from("tasks")
                  .update({
                    status: v as "backlog" | "todo" | "progress" | "done",
                    completed: v === "done",
                  })
                  .eq("id", task.id)
                  .then(() => onUpdated());
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KANBAN_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Time entries</Label>
              {!showAddTime && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowAddTime(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add manual entry
                </Button>
              )}
            </div>
            {taskTimeEntries.length > 0 ? (
              <div className="max-h-40 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8 text-xs">Start</TableHead>
                      <TableHead className="h-8 text-xs">End</TableHead>
                      <TableHead className="h-8 text-xs">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskTimeEntries.map((entry) => {
                      const start = new Date(entry.start_time);
                      const end = entry.end_time ? new Date(entry.end_time) : null;
                      const mins = end ? Math.round((end.getTime() - start.getTime()) / (60 * 1000)) : 0;
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="py-1.5 text-xs text-muted-foreground">
                            {start.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-1.5 text-xs text-muted-foreground">
                            {end ? end.toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="py-1.5 text-xs">
                            {formatDuration(mins)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              !showAddTime && (
                <p className="text-xs text-muted-foreground">No time entries for this task yet.</p>
              )
            )}
            {showAddTime && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input
                      type="datetime-local"
                      value={addTimeStart}
                      onChange={(e) => setAddTimeStart(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <Input
                      type="datetime-local"
                      value={addTimeEnd}
                      onChange={(e) => setAddTimeEnd(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setShowAddTime(false);
                      setAddTimeStart(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
                      setAddTimeEnd(new Date().toISOString().slice(0, 16));
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-[#3ECF8E] hover:bg-[#2EB67D]"
                    disabled={addingTime || new Date(addTimeEnd) <= new Date(addTimeStart)}
                    onClick={handleAddManualTime}
                  >
                    {addingTime ? "Adding…" : "Add entry"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
