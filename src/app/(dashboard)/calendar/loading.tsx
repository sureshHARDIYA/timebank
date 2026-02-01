import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: 35 }, (_, i) => `calendar-cell-${i}`).map((cellKey) => (
          <Skeleton key={cellKey} className="h-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}
