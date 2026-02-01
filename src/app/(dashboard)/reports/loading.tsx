import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-[220px]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-[220px]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="mt-1 h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
