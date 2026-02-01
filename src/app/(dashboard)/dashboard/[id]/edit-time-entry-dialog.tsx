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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Tag, Task, TimeEntry } from "@/types/database";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z
  .object({
    task_id: z.string().optional(),
    task_name: z.string().optional(),
    start_time: z.string().min(1, "Required"),
    end_time: z.string().min(1, "Required"),
  })
  .refine(
    (data) => {
      if (!data.start_time || !data.end_time) return true;
      return new Date(data.end_time) > new Date(data.start_time);
    },
    { message: "End time must be after start time", path: ["end_time"] }
  );

type FormData = z.infer<typeof schema>;

export function EditTimeEntryDialog({
  entry,
  tasks,
  tags,
  open,
  onOpenChange,
  onSaved,
}: {
  entry: TimeEntry | null;
  tasks: Task[];
  tags: Tag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      task_id: "",
      task_name: "",
      start_time: "",
      end_time: "",
    },
  });

  useEffect(() => {
    if (!entry || !open) return;
    form.reset({
      task_id: entry.task_id || "",
      task_name: entry.task_name || "",
      start_time: entry.start_time ? new Date(entry.start_time).toISOString().slice(0, 16) : "",
      end_time: entry.end_time ? new Date(entry.end_time).toISOString().slice(0, 16) : "",
    });
    setSelectedTagIds([]);
    if (entry.id) {
      setLoadingTags(true);
      void Promise.resolve(
        supabase
          .from("time_entry_tags")
          .select("tag_id")
          .eq("time_entry_id", entry.id)
          .then(({ data }) => {
            setSelectedTagIds((data ?? []).map((r) => r.tag_id));
          })
      ).finally(() => setLoadingTags(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form.reset and supabase are stable
  }, [entry, open]);

  async function onSubmit(data: FormData) {
    if (!entry) return;
    const { error } = await supabase
      .from("time_entries")
      .update({
        task_id: data.task_id || null,
        task_name: data.task_name || null,
        start_time: new Date(data.start_time).toISOString(),
        end_time: new Date(data.end_time).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
    if (error) {
      form.setError("root", { message: error.message });
      return;
    }
    await supabase.from("time_entry_tags").delete().eq("time_entry_id", entry.id);
    if (selectedTagIds.length > 0) {
      await supabase
        .from("time_entry_tags")
        .insert(selectedTagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id })));
    }
    onSaved();
    onOpenChange(false);
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit time entry</DialogTitle>
          <DialogDescription>Update task, times, and tags for this entry.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}
          <div className="space-y-2">
            <Label>Task (optional)</Label>
            <Select
              value={form.watch("task_id") || "__none__"}
              onValueChange={(v) => form.setValue("task_id", v === "__none__" ? "" : v)}
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
          </div>
          <div className="space-y-2">
            <Label>Or task name (ad-hoc)</Label>
            <Input placeholder="e.g. Meeting" {...form.register("task_name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start time</Label>
              <Input type="datetime-local" {...form.register("start_time")} />
              {form.formState.errors.start_time && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.start_time.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>End time</Label>
              <Input type="datetime-local" {...form.register("end_time")} />
              {form.formState.errors.end_time && (
                <p className="text-xs text-destructive">{form.formState.errors.end_time.message}</p>
              )}
            </div>
          </div>
          {tags.length > 0 && !loadingTags && (
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
