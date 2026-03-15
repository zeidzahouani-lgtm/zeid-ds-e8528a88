import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export function useScreens() {
  const queryClient = useQueryClient();
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["screens", currentEstablishmentId],
    queryFn: async () => {
      let query = supabase
        .from("screens")
        .select("*, media:current_media_id(id, name, type, url)")
        .order("created_at", { ascending: false });
      if (currentEstablishmentId) {
        query = query.eq("establishment_id", currentEstablishmentId);
      } else if (!isGlobalAdmin) {
        return [];
      }
      const { data, error } = await query;
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
      const { error } = await supabase.from("screens").insert({
        name,
        slug,
        user_id: user.id,
        establishment_id: currentEstablishmentId,
      } as any);
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
