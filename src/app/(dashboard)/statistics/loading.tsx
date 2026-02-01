import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatisticsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28" />
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
