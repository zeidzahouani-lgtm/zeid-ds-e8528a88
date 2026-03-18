import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlaylistItems(playlistId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["playlist_items", playlistId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    enabled: !!playlistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_items")
        .select("*, media:media_id(id, name, type, url, duration)")
        .eq("playlist_id", playlistId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addItem = useMutation({
    mutationFn: async ({ mediaId, position }: { mediaId: string; position: number }) => {
      const { error } = await supabase
        .from("playlist_items")
        .insert({ playlist_id: playlistId!, media_id: mediaId, position } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const reorderItems = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, i) =>
        supabase.from("playlist_items").update({ position: i }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateItemDuration = useMutation({
    mutationFn: async ({ id, duration }: { id: string; duration: number | null }) => {
      const { error } = await supabase
        .from("playlist_items")
        .update({ duration } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { items, isLoading, addItem, removeItem, reorderItems, updateItemDuration };
}
