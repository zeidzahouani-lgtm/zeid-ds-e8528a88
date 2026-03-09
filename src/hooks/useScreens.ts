import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useScreens() {
  const queryClient = useQueryClient();

  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["screens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screens")
        .select("*, media:current_media_id(id, name, type, url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("screens-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "screens" }, () => {
        queryClient.invalidateQueries({ queryKey: ["screens"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const addScreen = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
      const { error } = await supabase.from("screens").insert({ name, slug, user_id: user.id } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screens"] }),
  });

  const updateScreen = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; slug?: string; orientation?: string; current_media_id?: string | null; status?: string; layout_id?: string | null }) => {
      const { error } = await supabase.from("screens").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screens"] }),
  });

  const deleteScreen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("screens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screens"] }),
  });

  return { screens, isLoading, addScreen, updateScreen, deleteScreen };
}
