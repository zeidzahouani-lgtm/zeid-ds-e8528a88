import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadMediaFile, getMediaType } from "@/lib/supabase-helpers";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

/** Read the real duration of a local video/audio file (VOD-accurate playback). */
async function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) && el.duration > 0 ? Math.ceil(el.duration) : null);
    el.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    el.src = url;
  });
}

export function useMedia() {
  const queryClient = useQueryClient();
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  const { data: media = [], isLoading } = useQuery({
    queryKey: ["media", currentEstablishmentId, isGlobalAdmin],
    queryFn: async () => {
      let query = supabase.from("media").select("*").order("created_at", { ascending: false });
      // Global admin sees all media regardless of the selected establishment
      if (!isGlobalAdmin) {
        if (currentEstablishmentId) {
          query = query.eq("establishment_id", currentEstablishmentId);
        } else {
          // Non-admin without establishment sees nothing
          return [];
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, onProgress, duration }: { file: File; onProgress?: (p: number) => void; duration?: number }) => {
      const url = await uploadMediaFile(file, onProgress);
      const type = getMediaType(file);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const realDuration = type === "video" ? await probeDuration(file) : null;
      const { data, error } = await supabase.from("media").insert({
        name: file.name,
        type,
        url,
        duration: duration ?? (type === 'image' ? 10 : (realDuration ?? 30)),
        file_size: file.size,
        user_id: user.id,
        establishment_id: currentEstablishmentId,
      } as any).select("id").single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });


  const addIframeMutation = useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("media").insert({
        name,
        type: 'iframe',
        url,
        duration: 30,
        user_id: user.id,
        establishment_id: currentEstablishmentId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });

  const assignEstablishmentMutation = useMutation({
    mutationFn: async ({ id, establishmentId }: { id: string; establishmentId: string | null }) => {
      const { error } = await supabase
        .from("media")
        .update({ establishment_id: establishmentId } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      queryClient.invalidateQueries({ queryKey: ["est_dashboard_media"] });
    },
  });

  return { media, isLoading, uploadMutation, addIframeMutation, deleteMutation, assignEstablishmentMutation };
}
