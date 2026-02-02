"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/utils";
import type { Task } from "@/types/database";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { TimeEntryWithTags } from "./hooks";
import { TimeEntryRow } from "./time-entry-row";

type SortKey = "task" | "start" | "end" | "duration";
type SortDir = "asc" | "desc";

function SortButton({
  columnKey,
  label,
  sort,
  onToggleSort,
}: {
  columnKey: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  onToggleSort: (key: SortKey) => void;
}) {
  const isActive = sort.key === columnKey;
  const Icon = isActive ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 font-medium"
      onClick={() => onToggleSort(columnKey)}
    >
      {label}
      <Icon className={isActive ? "ml-1.5 h-4 w-4" : "ml-1.5 h-4 w-4 opacity-50"} />
    </Button>
  );
}

export function ProjectTimeEntriesCard({
  entries,
  tasks,
  onEdit,
  onDelete,
}: {
  entries: TimeEntryWithTags[];
  tasks: Task[];
  onEdit: (entry: TimeEntryWithTags) => void;
  onDelete: (entry: TimeEntryWithTags) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "start", dir: "desc" });

  function toggleSort(key: SortKey) {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  const sortedEntries: TimeEntryWithTags[] = [...entries]
    .sort((a, b) => {
      const aStart = new Date(a.start_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const aEnd = a.end_time ? new Date(a.end_time).getTime() : 0;
      const bEnd = b.end_time ? new Date(b.end_time).getTime() : 0;
      const aMins = aEnd ? (aEnd - aStart) / (60 * 1000) : 0;
      const bMins = bEnd ? (bEnd - bStart) / (60 * 1000) : 0;
      const aDesc = a.task_name ?? tasks.find((t) => t.id === a.task_id)?.name ?? "";
      const bDesc = b.task_name ?? tasks.find((t) => t.id === b.task_id)?.name ?? "";
      let cmp = 0;
      switch (sort.key) {
        case "task":
          cmp = aDesc.localeCompare(bDesc);
          break;
        case "start":
          cmp = aStart - bStart;
          break;
        case "end":
          cmp = (aEnd || 0) - (bEnd || 0);
          break;
        case "duration":
          cmp = aMins - bMins;
          break;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    })
    .slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent time entries</CardTitle>
        <p className="text-sm text-muted-foreground">
          Use the menu on each row to edit or delete. Start a timer from a task card or add time
          from the calendar.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="font-medium">Entry type:</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-white"
              style={{ backgroundColor: "#22c55e" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />A
            </span>
            <span>= Automatic (timer)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex rounded px-1.5 py-0.5 text-white"
              style={{ backgroundColor: "#2563eb" }}
            >
              M
            </span>
            <span>= Manual</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex rounded px-1.5 py-0.5 text-white"
              style={{ backgroundColor: "#ea580c" }}
            >
              C
            </span>
            <span>= Corrected (auto entry edited)</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time entries yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">Type</TableHead>
                <TableHead>
                  <SortButton
                    columnKey="task"
                    label="Task / Description"
                    sort={sort}
                    onToggleSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortButton
                    columnKey="start"
                    label="Start"
                    sort={sort}
                    onToggleSort={toggleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortButton columnKey="end" label="End" sort={sort} onToggleSort={toggleSort} />
                </TableHead>
                <TableHead>
                  <SortButton
                    columnKey="duration"
                    label="Duration"
                    sort={sort}
                    onToggleSort={toggleSort}
                  />
                </TableHead>
                <TableHead className="w-[140px]">Tags</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((entry) => (
                <TimeEntryRow
                  key={entry.id}
                  entry={entry}
                  entryTags={entry.entryTags ?? []}
                  tasks={tasks}
                  formatDuration={formatDuration}
                  onEdit={() => onEdit(entry)}
                  onDelete={() => onDelete(entry)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
