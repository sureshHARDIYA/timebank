"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Tag } from "@/types/database";
import type { Task, TimeEntry } from "@/types/database";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

type EntrySource = "automatic" | "manual" | "corrected";

export function EntrySourceBadge({ source }: { source: EntrySource }) {
  const resolved = source ?? "manual";
  if (resolved === "automatic") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-white"
        title="Automatic (timer)"
        style={{ backgroundColor: "#22c55e" }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />A
      </span>
    );
  }
  if (resolved === "corrected") {
    return (
      <span
        className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium text-white"
        title="Corrected (auto entry edited)"
        style={{ backgroundColor: "#ea580c" }}
      >
        C
      </span>
    );
  }
  return (
    <span
      className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium text-white"
      title="Manual"
      style={{ backgroundColor: "#2563eb" }}
    >
      M
    </span>
  );
}

export function TimeEntryRow({
  entry,
  entryTags,
  tasks,
  formatDuration,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  entryTags: Tag[];
  tasks: Task[];
  formatDuration: (mins: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = new Date(entry.start_time);
  const end = entry.end_time ? new Date(entry.end_time) : null;
  const mins = end ? (end.getTime() - start.getTime()) / (60 * 1000) : 0;
  const description = entry.task_name ?? tasks.find((t) => t.id === entry.task_id)?.name ?? "—";
  const source = (entry as { source?: EntrySource }).source ?? "manual";

  return (
    <TableRow>
      <TableCell className="w-12">
        <EntrySourceBadge source={source} />
      </TableCell>
      <TableCell className="font-medium">{description}</TableCell>
      <TableCell className="text-muted-foreground">{start.toLocaleString()}</TableCell>
      <TableCell className="text-muted-foreground">{end ? end.toLocaleString() : "—"}</TableCell>
      <TableCell>{formatDuration(Math.round(mins))}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {entryTags.map((tag) => (
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
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
