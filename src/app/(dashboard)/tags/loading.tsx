import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TagsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
