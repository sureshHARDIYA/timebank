import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

type ActiveTimerRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  task_name: string | null;
  started_at: string;
  tag_ids?: string[];
};

/**
 * Stops the current active timer for the user if one exists: saves it as a time
 * entry (when it has a project), then deletes it. Call before starting a new
 * timer so only one timer runs at a time.
 * Pass userId from useUser() to avoid an extra auth.getUser() call.
 */
export async function stopCurrentTimerIfAny(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  userId?: string | null
): Promise<void> {
  const id = userId ?? (await supabase.auth.getUser().then((r) => r.data.user?.id ?? null));
  if (!id) return;

  const { data: current } = await supabase
    .from("active_timers")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  if (!current) return;

  const timer = current as ActiveTimerRow;
  const tagIds = timer.tag_ids ?? [];

  if (timer.project_id) {
    const { data: entry } = await supabase
      .from("time_entries")
      .insert({
        user_id: id,
        project_id: timer.project_id,
        task_id: timer.task_id ?? null,
        task_name: timer.task_name ?? null,
        start_time: timer.started_at,
        end_time: new Date().toISOString(),
        source: "automatic",
      })
      .select("id")
      .single();
    if (entry?.id && tagIds.length > 0) {
      await supabase
        .from("time_entry_tags")
        .insert(tagIds.map((tag_id) => ({ time_entry_id: entry.id, tag_id })));
    }
    queryClient.invalidateQueries({ queryKey: ["time-entries", timer.project_id] });
  }

  await supabase.from("active_timers").delete().eq("user_id", id);
  queryClient.invalidateQueries({ queryKey: ["active-timer"] });
}
