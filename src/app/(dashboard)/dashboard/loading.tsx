import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-5 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
