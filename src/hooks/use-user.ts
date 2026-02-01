"use client";

import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useUser() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ?? null;
    },
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Only refetch user when identity actually changes; skip INITIAL_SESSION and TOKEN_REFRESHED
      // to avoid redundant /auth/v1/user calls (e.g. tab focus, token refresh).
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["user"] });
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth, queryClient]);

  return query;
}
