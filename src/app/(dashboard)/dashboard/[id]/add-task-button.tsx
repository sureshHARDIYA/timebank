"use client";

import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { Tag } from "@/types/database";
import { Plus } from "lucide-react";
import { useState } from "react";

export function AddTaskButton({
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
      .insert({
        project_id: projectId,
        name: name.trim(),
        status: "backlog",
        task_number: nextNumber,
      })
      .select("id")
      .single();
    if (error) return;
    if (task?.id && selectedTagIds.length > 0) {
      await supabase
        .from("task_tags")
        .insert(selectedTagIds.map((tag_id) => ({ task_id: task.id, tag_id })));
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
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addTask} className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
                Add
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
