"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TimeEntry } from "@/types/database";

function useTimeByTag() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["statistics-tags"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { byTag: [] as { tagName: string; projectName: string; minutes: number }[], byTagOnly: [] as { name: string; minutes: number }[] };

      const { data: entries, error: e1 } = await supabase
        .from("time_entries")
        .select("id, project_id, start_time, end_time")
        .eq("user_id", user.id)
        .not("end_time", "is", null);
      if (e1 || !entries?.length) return { byTag: [], byTagOnly: [] };

      const entryIds = entries.map((e) => e.id);
      const { data: links, error: e2 } = await supabase
        .from("time_entry_tags")
        .select("time_entry_id, tag_id")
        .in("time_entry_id", entryIds);
      if (e2) return { byTag: [], byTagOnly: [] };

      const tagIds = [...new Set((links ?? []).map((l) => l.tag_id))];
      const { data: tags, error: e3 } = await supabase
        .from("tags")
        .select("id, name, color")
        .in("id", tagIds);
      if (e3) return { byTag: [], byTagOnly: [] };

      const tagById = Object.fromEntries((tags ?? []).map((t) => [t.id, t]));

      const byTag: Record<string, number> = {};
      (entries as TimeEntry[]).forEach((e) => {
        if (!e.end_time) return;
        const start = new Date(e.start_time).getTime();
        const end = new Date(e.end_time).getTime();
        const mins = (end - start) / (60 * 1000);
        const entryLinks = (links ?? []).filter((l) => l.time_entry_id === e.id);
        if (entryLinks.length === 0) {
          byTag["Untagged"] = (byTag["Untagged"] ?? 0) + mins;
        } else {
          entryLinks.forEach((l) => {
            const tag = tagById[l.tag_id];
            const name = tag?.name ?? "—";
            byTag[name] = (byTag[name] ?? 0) + mins;
          });
        }
      });

      const byTagOnly = Object.entries(byTag)
        .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
        .sort((a, b) => b.minutes - a.minutes);

      return { byTagOnly };
    },
  });
}

export default function StatisticsPage() {
  const { data, isLoading } = useTimeByTag();
  const byTagOnly = data?.byTagOnly ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
        <p className="text-muted-foreground">
          Overview of how much time was spent on each tag across all projects.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Loading…</p>
          </CardContent>
        </Card>
      ) : byTagOnly.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center text-center">
            <p className="text-muted-foreground">No tagged time entries yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create tags on your projects and assign them when logging time to see statistics here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Time by tag (all projects)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total time attributed to each tag. Entries with multiple tags count toward each tag.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byTagOnly}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `${v}m`} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [formatDuration(value), "Minutes"]}
                    labelFormatter={(_, payload) => payload[0]?.payload?.name}
                  />
                  <Bar dataKey="minutes" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
