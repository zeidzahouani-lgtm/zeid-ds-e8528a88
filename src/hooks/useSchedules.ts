import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Schedule {
  id: string;
  screen_id: string;
  media_id: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  active: boolean;
  created_at: string;
  media?: { id: string; name: string; type: string; url: string } | null;
}

export function useSchedules(screenId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["schedules", screenId];

  const { data: schedules = [], isLoading } = useQuery({
    queryKey,
    enabled: !!screenId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*, media:media_id(id, name, type, url)")
        .eq("screen_id", screenId!)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as Schedule[];
    },
  });

  const addSchedule = useMutation({
    mutationFn: async (schedule: {
      media_id: string;
      start_time: string;
      end_time: string;
      days_of_week: number[];
    }) => {
      const { error } = await supabase
        .from("schedules")
        .insert({ ...schedule, screen_id: screenId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Schedule> & { id: string }) => {
      const { error } = await supabase.from("schedules").update(updates).eq("id", id);
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
