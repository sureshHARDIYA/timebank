"use client";

import { createClient } from "@/lib/supabase/client";
import type { Client, Project } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "./use-user";

export type ProjectWithClient = Project & { clients: Client | null };

/**
 * Single shared projects query (full data with clients) so dashboard and
 * QuickStartTimerModal share the same cache and only one request is made.
 */
export function useProjects(options?: { search?: string }) {
  const supabase = createClient();
  const { data: user } = useUser();
  const search = options?.search ?? "";

  return useQuery({
    queryKey: ["projects", user?.id, search],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      let q = supabase
        .from("projects")
        .select("*, clients(id, name, email, hourly_rate_usd)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (search?.trim()) {
        q = q.ilike("name", `%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProjectWithClient[];
    },
  });
}
