import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  establishment_id: string | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface UseActivityLogsOptions {
  search?: string;
  action?: string;
  limit?: number;
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const { search = "", action = "", limit = 500 } = options;

  return useQuery({
    queryKey: ["activity_logs", search, action, limit],
    queryFn: async () => {
      let q = (supabase.from("activity_logs" as any) as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (action) q = q.eq("action", action);
      if (search) {
        q = q.or(
          `user_email.ilike.%${search}%,description.ilike.%${search}%,entity_type.ilike.%${search}%,action.ilike.%${search}%`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
    refetchInterval: 15_000,
  });
}
