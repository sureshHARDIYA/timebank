"use client";

import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { Tag, Plus, Pencil, Trash2 } from "lucide-react";
import { PRESET_COLORS } from "@/components/tags/tag-multi-select";
import type { Tag as TagType } from "@/types/database";

function useUserTags() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data as TagType[];
    },
  });
}

export default function TagsPage() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTag, setEditTag] = useState<TagType | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3ECF8E");
  const [error, setError] = useState<string | null>(null);

  const { data: tags = [], isLoading } = useUserTags();

  async function createTag() {
    if (!name.trim()) return;
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("tags").insert({
      user_id: user.id,
      name: name.trim(),
      color,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    setColor("#3ECF8E");
    setCreateOpen(false);
    queryClient.invalidateQueries({ queryKey: ["tags"] });
  }

  async function updateTag() {
    if (!editTag) return;
    if (!name.trim()) return;
    setError(null);
    const { error: err } = await supabase
      .from("tags")
      .update({ name: name.trim(), color })
      .eq("id", editTag.id);
    if (err) {
      setError(err.message);
      return;
    }
    setEditTag(null);
    setName("");
    setColor("#3ECF8E");
    queryClient.invalidateQueries({ queryKey: ["tags"] });
  }

  async function deleteTag(tagId: string) {
    setError(null);
    const { error: err } = await supabase.from("tags").delete().eq("id", tagId);
    if (err) {
      setError(err.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["tags"] });
  }

  function openEdit(tag: TagType) {
    setEditTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setError(null);
  }

  function closeEdit() {
    setEditTag(null);
    setName("");
    setColor("#3ECF8E");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
        <p className="text-muted-foreground">
          Create and manage your tags. Assign them to time entries when logging
          time.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4" />
            Your tags
          </CardTitle>
          <Button
            size="sm"
            className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
            onClick={() => {
              setCreateOpen(true);
              setName("");
              setColor("#3ECF8E");
              setError(null);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            New tag
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tags yet. Create one to assign when logging time.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag: TagType) => (
                <li
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}33` : undefined,
                    color: tag.color || undefined,
                  }}
                >
                  <span>{tag.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-black/10"
                    onClick={() => openEdit(tag)}
                    aria-label={`Edit ${tag.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-black/10"
                    onClick={() => {
                      if (confirm(`Delete tag "${tag.name}"?`))
                        deleteTag(tag.id);
                    }}
                    aria-label={`Delete ${tag.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New tag</DialogTitle>
            <DialogDescription>
              Create a tag. You can assign it to any time entry when logging
              time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Development"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTag()}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      color === c
                        ? "scale-110 border-foreground"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={createTag}
                className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
                disabled={!name.trim()}
              >
                Add tag
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTag} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tag</DialogTitle>
            <DialogDescription>Change the tag name or color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Development"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && updateTag()}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      color === c
                        ? "scale-110 border-foreground"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button
                onClick={updateTag}
                className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
                disabled={!name.trim()}
              >
                Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
