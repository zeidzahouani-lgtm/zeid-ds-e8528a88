import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Content {
  id: string;
  image_url: string;
  start_time: string | null;
  end_time: string | null;
  screen_id: string | null;
  status: "pending" | "scheduled" | "active" | "rejected";
  title: string | null;
  source: string | null;
  sender_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function useContents() {
  const queryClient = useQueryClient();

  const { data: contents = [], isLoading } = useQuery({
    queryKey: ["contents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contents")
        .select("*")
        .order("created_at", { ascending: false }) as any;
      if (error) throw error;
      return data as Content[];
    },
  });

  // Realtime subscription
  const subscribeRealtime = () => {
    const channel = supabase
      .channel("contents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "contents" }, () => {
        queryClient.invalidateQueries({ queryKey: ["contents"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("contents") as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contents"] }),
  });

  const deleteContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("contents") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contents"] }),
  });

  return { contents, isLoading, updateStatus, deleteContent, subscribeRealtime };
}
