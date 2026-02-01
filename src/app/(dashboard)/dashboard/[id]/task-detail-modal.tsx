"use client";

import { GitHubStyleEditor } from "@/components/editor/github-style-editor";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatTaskIdentifierWithProject } from "@/lib/utils";
import type { Tag } from "@/types/database";
import type { TimeEntry } from "@/types/database";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const { data: user } = useUser();
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const descriptionRef = useRef(description);
  const editorGetHtmlRef = useRef<(() => string) | null>(null);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when modal opens for this task (task?.id), not on every task field change
  useEffect(() => {
    if (task && open) {
      const desc = task.description ?? "";
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      queueMicrotask(() => {
        setName(task.name);
        setDescription(desc);
        descriptionRef.current = desc;
        setStatus((task as { status?: string }).status ?? (task.completed ? "done" : "todo"));
        setSelectedTagIds((task.task_tags ?? []).map((tt) => tt.tag_id));
        setShowAddTime(false);
        setAddTimeStart(oneHourAgo.toISOString().slice(0, 16));
        setAddTimeEnd(now.toISOString().slice(0, 16));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when modal opens for this task
  }, [task?.id, open]);

  const effectiveStatus = (task?.status ?? (task?.completed ? "done" : "todo")) as string;
  const currentStatus = status || effectiveStatus;

  async function save() {
    if (!task) return;
    setSaving(true);
    // Read from Lexical editor when available (e.g. on dialog close) so we persist the latest content
    const fromEditor = editorGetHtmlRef.current?.();
    const latestDescription = typeof fromEditor === "string" ? fromEditor : descriptionRef.current;
    const descriptionToSave =
      (latestDescription ?? "").trim().length > 0 ? (latestDescription ?? "").trim() : null;
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        name: name.trim() || task.name,
        description: descriptionToSave,
        status: currentStatus as "backlog" | "todo" | "progress" | "done",
        completed: currentStatus === "done",
      })
      .eq("id", task.id)
      .select("id, description")
      .single();
    if (updateError) {
      console.error("Task update failed:", updateError);
      setSaving(false);
      return;
    }
    try {
      await supabase.from("task_tags").delete().eq("task_id", task.id);
      if (selectedTagIds.length > 0) {
        await supabase
          .from("task_tags")
          .insert(selectedTagIds.map((tag_id) => ({ task_id: task.id, tag_id })));
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
    if (!task || !user) return;
    const start = new Date(addTimeStart);
    const end = new Date(addTimeEnd);
    if (end <= start) return;
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
      await supabase
        .from("time_entry_tags")
        .insert(selectedTagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id })));
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

  const taskNumber = (task as { task_number?: number }).task_number;
  const identifier = formatTaskIdentifierWithProject(taskNumber, projectName);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          save();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <div className="relative">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-medium">{identifier}</DialogTitle>
              <Button onClick={handleStartTimer} className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
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
              <GitHubStyleEditor
                editorKey={task?.id ?? "task-desc"}
                value={description}
                getHtmlRef={editorGetHtmlRef}
                onChange={(html) => {
                  descriptionRef.current = html;
                  setDescription(html);
                }}
                onBlur={(html) => {
                  descriptionRef.current = html;
                  setDescription(html);
                  save();
                }}
                placeholder="Optional description"
                minHeight="120px"
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
                        const mins = end
                          ? Math.round((end.getTime() - start.getTime()) / (60 * 1000))
                          : 0;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="py-1.5 text-xs text-muted-foreground">
                              {start.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs text-muted-foreground">
                              {end ? end.toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs">{formatDuration(mins)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                !showAddTime && (
                  <p className="text-xs text-muted-foreground">
                    No time entries for this task yet.
                  </p>
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
              <Button variant="outline" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
