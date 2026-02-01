"use client";

import { createClient } from "@/lib/supabase/client";
import type { Tag } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "./use-user";

export function useTags(options?: { enabled?: boolean }) {
  const supabase = createClient();
  const { data: user } = useUser();
  const enabled = options?.enabled !== false;

  return useQuery({
    queryKey: ["tags", user?.id],
    enabled: !!user?.id && enabled,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });
}
