import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export interface TrackedSchedule {
  id: string;
  screen_id: string | null;
  media_id: string | null;
  playlist_id: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string | null;
  end_date: string | null;
  reminder_minutes: number | null;
  active: boolean;
  media?: { id: string; name: string } | null;
  playlist?: { id: string; name: string } | null;
  screen?: { id: string; name: string; establishment_id: string | null } | null;
}

const SELECT =
  "id, screen_id, media_id, playlist_id, start_time, end_time, days_of_week, start_date, end_date, reminder_minutes, active, media:media_id(id, name), playlist:playlist_id(id, name), screen:screen_id(id, name, establishment_id)";

export function useTrackedSchedules() {
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  const { data: schedules = [], isLoading, refetch } = useQuery({
    queryKey: ["tracked_schedules", currentEstablishmentId, isGlobalAdmin],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select(SELECT)
        .not("screen_id", "is", null)
        .order("start_time", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as TrackedSchedule[];
      if (currentEstablishmentId) {
        return rows.filter((r) => r.screen?.establishment_id === currentEstablishmentId);
      }
      return isGlobalAdmin ? rows : [];
    },
  });

  return { schedules, isLoading, refetch };
}

/** Lance immédiatement le contenu d'un créneau sur son écran */
export function useLaunchSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sch: TrackedSchedule) => {
      if (!sch.screen_id) throw new Error("Ce créneau n'est lié à aucun écran");
      const updates: Record<string, any> = { pending_action: "resync" };
      if (sch.playlist_id) {
        updates.playlist_id = sch.playlist_id;
        updates.current_media_id = null;
      } else if (sch.media_id) {
        updates.current_media_id = sch.media_id;
        updates.playlist_id = null;
      } else {
        throw new Error("Ce créneau n'a aucun contenu associé");
      }
      const { error } = await supabase.from("screens").update(updates as any).eq("id", sch.screen_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screens"] });
    },
  });
}
