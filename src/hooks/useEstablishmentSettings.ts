import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export function useEstablishmentSettings(establishmentId?: string | null) {
  const queryClient = useQueryClient();
  const { currentEstablishmentId } = useEstablishmentContext();
  const estId = establishmentId ?? currentEstablishmentId;

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["establishment_settings", estId],
    enabled: !!estId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("establishment_settings")
        .select("*")
        .eq("establishment_id", estId!);
      if (error) throw error;
      return data;
    },
  });

  const getSetting = (key: string) => {
    const found = settings.find((s: any) => s.key === key);
    return found?.value ?? null;
  };

  const upsertSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | null }) => {
      if (!estId) throw new Error("No establishment selected");
      const { data: { user } } = await supabase.auth.getUser();
      // Upsert: try update first, then insert
      const { data: existing } = await supabase
        .from("establishment_settings")
        .select("id")
        .eq("establishment_id", estId)
        .eq("key", key)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from("establishment_settings")
          .update({ value, updated_by: user?.id } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("establishment_settings")
          .insert({ establishment_id: estId, key, value, updated_by: user?.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["establishment_settings", estId] }),
  });

  return { settings, isLoading, getSetting, upsertSetting };
}
