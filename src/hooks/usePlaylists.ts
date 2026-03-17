import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export interface Playlist {
  id: string;
  name: string;
  user_id: string | null;
  establishment_id: string | null;
  created_at: string;
}

export function usePlaylists() {
  const queryClient = useQueryClient();
  const { currentEstablishmentId } = useEstablishmentContext();
  const queryKey = ["playlists", currentEstablishmentId];

  const { data: playlists = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from("playlists").select("*").order("created_at", { ascending: false });
      if (currentEstablishmentId) {
        q = q.eq("establishment_id", currentEstablishmentId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Playlist[];
    },
  });

  const addPlaylist = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data, error } = await supabase.from("playlists").insert({
        name,
        user_id: user.id,
        establishment_id: currentEstablishmentId || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deletePlaylist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const renamePlaylist = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("playlists").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { playlists, isLoading, addPlaylist, deletePlaylist, renamePlaylist };
}
