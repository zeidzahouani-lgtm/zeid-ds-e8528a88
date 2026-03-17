import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export interface Program {
  id: string;
  name: string;
  user_id: string | null;
  establishment_id: string | null;
  created_at: string;
}

export function usePrograms() {
  const queryClient = useQueryClient();
  const { currentEstablishmentId } = useEstablishmentContext();
  const queryKey = ["programs", currentEstablishmentId];

  const { data: programs = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from("programs").select("*").order("created_at", { ascending: false });
      if (currentEstablishmentId) {
        q = q.eq("establishment_id", currentEstablishmentId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Program[];
    },
  });

  const addProgram = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data, error } = await supabase.from("programs").insert({
        name,
        user_id: user.id,
        establishment_id: currentEstablishmentId || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteProgram = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("programs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const renameProgram = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("programs").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { programs, isLoading, addProgram, deleteProgram, renameProgram };
}
