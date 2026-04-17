import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Schedule {
  id: string;
  program_id: string | null;
  screen_id: string | null;
  media_id: string | null;
  playlist_id: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  created_at: string;
  media?: { id: string; name: string; type: string; url: string } | null;
  playlist?: { id: string; name: string } | null;
}

export function useSchedules(programId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["schedules", programId];

  const { data: schedules = [], isLoading } = useQuery({
    queryKey,
    enabled: !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*, media:media_id(id, name, type, url), playlist:playlist_id(id, name)")
        .eq("program_id", programId!)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as Schedule[];
    },
  });

  const addSchedule = useMutation({
    mutationFn: async (schedule: {
      media_id?: string | null;
      playlist_id?: string | null;
      start_time: string;
      end_time: string;
      days_of_week: number[];
      start_date?: string | null;
      end_date?: string | null;
    }) => {
      const { error } = await supabase
        .from("schedules")
        .insert({ ...schedule, program_id: programId! } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Schedule> & { id: string }) => {
      const { media, playlist, ...dbUpdates } = updates as any;
      const { error } = await supabase.from("schedules").update(dbUpdates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { schedules, isLoading, addSchedule, updateSchedule, deleteSchedule };
}
