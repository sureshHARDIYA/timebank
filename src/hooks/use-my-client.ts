"use client";

import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "./use-user";

/**
 * Returns the client record when the current user is an invited client (clients.invited_user_id = user.id).
 * Returns null for owners.
 */
export function useMyClient() {
  const supabase = createClient();
  const { data: user } = useUser();

  return useQuery({
    queryKey: ["my-client", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Client | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("invited_user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });
}
