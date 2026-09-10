import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScreenSchedule {
  id: string;
  screen_id: string | null;
  program_id: string | null;
  media_id: string | null;
  playlist_id: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string | null;
  end_date: string | null;
  reminder_minutes: number | null;
  active: boolean;
  created_at: string;
  media?: { id: string; name: string } | null;
  playlist?: { id: string; name: string } | null;
}

export interface NewScreenSchedule {
  media_id?: string | null;
  playlist_id?: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date?: string | null;
  end_date?: string | null;
  reminder_minutes?: number | null;
}

const SELECT =
  "id, screen_id, program_id, media_id, playlist_id, start_time, end_time, days_of_week, start_date, end_date, reminder_minutes, active, created_at, media:media_id(id, name), playlist:playlist_id(id, name)";

export function useScreenSchedules(screenId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["screen_schedules", screenId];

  const { data: schedules = [], isLoading } = useQuery({
    queryKey,
    enabled: !!screenId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select(SELECT)
        .eq("screen_id", screenId!)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ScreenSchedule[];
    },
  });

  const addSchedule = useMutation({
    mutationFn: async (schedule: NewScreenSchedule) => {
      const { error } = await supabase
        .from("schedules")
        .insert({ ...schedule, screen_id: screenId!, program_id: null } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScreenSchedule> & { id: string }) => {
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
