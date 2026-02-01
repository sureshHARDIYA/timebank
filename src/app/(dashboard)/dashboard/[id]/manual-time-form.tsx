"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import type { Task, Tag } from "@/types/database";

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

export function ManualTimeForm({
  projectId,
  tasks,
  tags,
  onSubmitted,
}: {
  projectId: string;
  tasks: Task[];
  tags: Tag[];
  onSubmitted: () => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      task_id: "",
      task_name: "",
      start_time: new Date(Date.now() - 3600000).toISOString().slice(0, 16),
      end_time: new Date().toISOString().slice(0, 16),
    },
  });

  async function onSubmit(data: FormData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: entry, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        project_id: projectId,
        task_id: data.task_id || null,
        task_name: data.task_name || null,
        start_time: new Date(data.start_time).toISOString(),
        end_time: new Date(data.end_time).toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      form.setError("root", { message: error.message });
      return;
    }
    if (entry?.id && selectedTagIds.length > 0) {
      await supabase.from("time_entry_tags").insert(
        selectedTagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id }))
      );
    }
    form.reset({
      task_id: "",
      task_name: "",
      start_time: new Date(Date.now() - 3600000).toISOString().slice(0, 16),
      end_time: new Date().toISOString().slice(0, 16),
    });
    setSelectedTagIds([]);
    setOpen(false);
    onSubmitted();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Add time manually</CardTitle>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Open form
          </Button>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Task (optional)</Label>
                <Select
                  value={form.watch("task_id") || "none"}
                  onValueChange={(v) => form.setValue("task_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select task or leave blank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
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
                <Input
                  placeholder="e.g. Meeting"
                  {...form.register("task_name")}
                />
              </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start time</Label>
                <Input type="datetime-local" {...form.register("start_time")} />
                {form.formState.errors.start_time && (
                  <p className="text-xs text-destructive">{form.formState.errors.start_time.message}</p>
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
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
                Save entry
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
