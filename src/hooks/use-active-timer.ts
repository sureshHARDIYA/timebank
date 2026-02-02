"use client";

import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "./use-user";

export type ActiveTimerOptions = {
  refetchInterval?: number;
};

export function useActiveTimer(options?: ActiveTimerOptions) {
  const supabase = createClient();
  const { data: user } = useUser();

  return useQuery({
    queryKey: ["active-timer", user?.id],
    enabled: !!user?.id,
    refetchInterval: options?.refetchInterval,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("active_timers")
        .select("id, project_id, task_id, task_name, started_at, project:projects(name), tag_ids")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateActiveTimer() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["active-timer"] });
}
