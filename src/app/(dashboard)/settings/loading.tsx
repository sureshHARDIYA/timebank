import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-20" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full max-w-md" />
        </CardContent>
      </Card>
    </div>
  );
}
