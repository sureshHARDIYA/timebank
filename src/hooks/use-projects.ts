"use client";

import { createClient } from "@/lib/supabase/client";
import type { Client, Project } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "./use-user";

export type ProjectWithClient = Project & { clients: Client | null };

/**
 * Single shared projects query (full data with clients) so dashboard and
 * QuickStartTimerModal share the same cache and only one request is made.
 * Pass enabled: false (e.g. when modal is closed) to avoid fetching until needed.
 */
export function useProjects(options?: {
  search?: string;
  clientId?: string | null;
  enabled?: boolean;
}) {
  const supabase = createClient();
  const { data: user } = useUser();
  const search = options?.search ?? "";
  const clientId = options?.clientId ?? null;
  const enabled = options?.enabled !== false && !!user?.id;

  return useQuery({
    queryKey: ["projects", user?.id, search, clientId],
    enabled,
    staleTime: 2 * 60 * 1000,
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
      if (clientId) {
        q = q.eq("client_id", clientId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProjectWithClient[];
    },
  });
}
