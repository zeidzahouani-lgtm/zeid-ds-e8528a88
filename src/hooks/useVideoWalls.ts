import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export function useVideoWalls() {
  const queryClient = useQueryClient();
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  const { data: walls = [], isLoading } = useQuery({
    queryKey: ["video_walls", currentEstablishmentId, isGlobalAdmin],
    queryFn: async () => {
      let query = (supabase as any).from("video_walls").select("*").order("created_at", { ascending: false });
      if (currentEstablishmentId) query = query.eq("establishment_id", currentEstablishmentId);
      else if (!isGlobalAdmin) return [];
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const createWall = useMutation({
    mutationFn: async ({ name, rows, cols }: { name: string; rows: number; cols: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Quota check
      if (currentEstablishmentId) {
        const { data: est } = await supabase
          .from("establishments")
          .select("max_screens")
          .eq("id", currentEstablishmentId)
          .single();
        const { count } = await supabase
          .from("screens")
          .select("id", { count: "exact", head: true })
          .eq("establishment_id", currentEstablishmentId);
        const max = est?.max_screens ?? 0;
        const need = rows * cols;
        if (max > 0 && (count ?? 0) + need > max) {
          throw new Error(`Quota atteint : il faut ${need} écrans, ${max - (count ?? 0)} disponible(s).`);
        }
      }

      // Create the wall
      const { data: wall, error: wallErr } = await (supabase as any)
        .from("video_walls")
        .insert({ name, rows, cols, user_id: user.id, establishment_id: currentEstablishmentId })
        .select()
        .single();
      if (wallErr) throw wallErr;

      // Create N screens
      const screens = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const screenName = `${name} [${r + 1}-${c + 1}]`;
          const slug = `${name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-")}-${r + 1}-${c + 1}`;
          screens.push({
            name: screenName,
            slug,
            user_id: user.id,
            establishment_id: currentEstablishmentId,
            wall_id: wall.id,
            wall_row: r,
            wall_col: c,
          });
        }
      }
      const { error: scrErr } = await supabase.from("screens").insert(screens as any);
      if (scrErr) throw scrErr;

      return wall;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_walls"] });
      queryClient.invalidateQueries({ queryKey: ["screens"] });
    },
  });

  const deleteWall = useMutation({
    mutationFn: async (id: string) => {
      // Detach screens first (ON DELETE SET NULL handles wall_id, but row/col stay — clear them)
      await supabase.from("screens").update({ wall_row: null, wall_col: null } as any).eq("wall_id", id);
      const { error } = await (supabase as any).from("video_walls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_walls"] });
      queryClient.invalidateQueries({ queryKey: ["screens"] });
    },
  });

  return { walls, isLoading, createWall, deleteWall };
}
