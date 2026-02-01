"use client";

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
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, setHours, setMinutes } from "date-fns";
import { useEffect, useState } from "react";

function useProjectTasks(projectId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

export function CalendarAddTimeModal({
  selectedDate,
  open,
  onClose,
  onSubmitted,
}: {
  selectedDate: Date | null;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: tasks = [] } = useProjectTasks(projectId || null);
  const { data: tags = [] } = useTags({ enabled: open });

  useEffect(() => {
    if (!selectedDate || !open) return;
    const dayStart = setMinutes(setHours(selectedDate, 9), 0);
    const dayEnd = setMinutes(setHours(selectedDate, 17), 0);
    queueMicrotask(() => {
      setStartStr(format(dayStart, "yyyy-MM-dd'T'HH:mm"));
      setEndStr(format(dayEnd, "yyyy-MM-dd'T'HH:mm"));
    });
  }, [selectedDate, open]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setProjectId("");
        setTaskId("");
        setTaskName("");
        setSelectedTagIds([]);
      });
    }
  }, [open]);

  async function handleSubmit() {
    if (!user || !projectId || !startStr || !endStr) return;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (end <= start) return;
    setSubmitting(true);
    const { data: entry, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        project_id: projectId,
        task_id: taskId || null,
        task_name: taskName.trim() || null,
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
    setSubmitting(false);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["calendar-entries"] });
      onSubmitted();
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add time {selectedDate ? `for ${format(selectedDate, "MMM d, yyyy")}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                setTaskId("");
              }}
            >
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
          {projectId && (
            <>
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
                <Input
                  placeholder="Or type task name"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
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
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !projectId ||
              !startStr ||
              !endStr ||
              new Date(endStr) <= new Date(startStr) ||
              submitting
            }
            className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
          >
            Add time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
