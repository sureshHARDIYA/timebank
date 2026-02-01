"use client";

import { cn } from "@/lib/utils";
import type { Tag } from "@/types/database";

const PRESET_COLORS = [
  "#3ECF8E",
  "#2EB67D",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
];

export function TagMultiSelect({
  tags,
  selectedIds,
  onChange,
  disabled,
  className,
}: {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const toggle = (id: string) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => {
        const selected = selectedIds.includes(tag.id);
        const bgColor = tag.color || "#3ECF8E";
        return (
          <button
            key={tag.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(tag.id)}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              selected ? "border-transparent text-white" : "border-transparent",
              disabled && "cursor-not-allowed opacity-60"
            )}
            style={{
              backgroundColor: selected ? bgColor : `${bgColor}33`,
              color: selected ? "#fff" : bgColor,
            }}
          >
            {tag.name}
          </button>
        );
      })}
      {tags.length === 0 && (
        <span className="text-xs text-muted-foreground">No tags. Add tags in the Tags page (sidebar).</span>
      )}
    </div>
  );
}

export { PRESET_COLORS };
