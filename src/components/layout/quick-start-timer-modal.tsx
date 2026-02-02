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
import { stopCurrentTimerIfAny } from "@/lib/timer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
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

export function QuickStartTimerModal({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  onStarted?: () => void;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const { data: projects = [] } = useProjects({ enabled: open });
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  const { data: tasks = [] } = useProjectTasks(projectId || null);
  const { data: tags = [] } = useTags({ enabled: open });

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

  async function handleStart() {
    if (!user || !projectId) return;
    const taskLabel = taskId
      ? (tasks.find((t) => t.id === taskId)?.name ?? taskName.trim())
      : taskName.trim() || null;
    setStarting(true);
    await stopCurrentTimerIfAny(supabase, queryClient, user.id);
    await supabase.from("active_timers").upsert(
      {
        user_id: user.id,
        project_id: projectId,
        task_id: taskId || null,
        task_name: taskLabel || null,
        started_at: new Date().toISOString(),
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : [],
      },
      { onConflict: "user_id" }
    );
    queryClient.invalidateQueries({ queryKey: ["active-timer"] });
    setStarting(false);
    onStarted?.();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start timer</DialogTitle>
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
            onClick={handleStart}
            disabled={!projectId || starting}
            className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
          >
            <Play className="mr-2 h-4 w-4" />
            {starting ? "Starting…" : "Start timer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
