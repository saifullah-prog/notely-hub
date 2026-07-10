import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";

export type Profile = {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
};

/** Whether the current user is an admin (checked against the profiles table). */
export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["isAdmin", user?.id],
    enabled: Boolean(user) && isSupabaseConfigured,
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (error) return false;
      return Boolean(data?.is_admin);
    },
  });
}

/** All user profiles — only returns rows the caller is allowed to see (admins). */
export function useProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ["profiles"],
    enabled: enabled && isSupabaseConfigured,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}
