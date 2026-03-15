import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export interface LayoutRegion {
  id: string;
  layout_id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  media_id: string | null;
  media?: { id: string; name: string; type: string; url: string } | null;
  created_at: string;
}

export interface Layout {
  id: string;
  name: string;
  width: number;
  height: number;
  background_color: string;
  bg_type: string;
  bg_image_url: string | null;
  bg_image_fit: string;
  user_id: string;
  establishment_id?: string | null;
  created_at: string;
  updated_at: string;
  regions?: LayoutRegion[];
}

export function useLayouts() {
  const queryClient = useQueryClient();
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  const { data: layouts = [], isLoading } = useQuery({
    queryKey: ["layouts", currentEstablishmentId],
    queryFn: async () => {
      let query = supabase
        .from("layouts")
        .select("*")
        .order("created_at", { ascending: false });
      if (currentEstablishmentId) {
        query = query.eq("establishment_id", currentEstablishmentId);
      } else if (!isGlobalAdmin) {
        return [];
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Layout[];
    },
  });

  const addLayout = useMutation({
    mutationFn: async (params: { name: string; width?: number; height?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("layouts")
        .insert({
          name: params.name,
          width: params.width || 1920,
          height: params.height || 1080,
          user_id: user.id,
          establishment_id: currentEstablishmentId,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layouts"] }),
  });

  const deleteLayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("layouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layouts"] }),
  });

  const updateLayout = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; width?: number; height?: number; background_color?: string }) => {
      const { error } = await supabase.from("layouts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layouts"] }),
  });

  return { layouts, isLoading, addLayout, deleteLayout, updateLayout };
}

export function useLayoutRegions(layoutId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: regions = [], isLoading } = useQuery({
    queryKey: ["layout_regions", layoutId],
    enabled: !!layoutId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("layout_regions")
        .select("*, media:media_id(id, name, type, url)")
        .eq("layout_id", layoutId!)
        .order("z_index", { ascending: true });
      if (error) throw error;
      return data as LayoutRegion[];
    },
  });

  const addRegion = useMutation({
    mutationFn: async (params: Partial<LayoutRegion> & { layout_id: string }) => {
      const { data, error } = await supabase
        .from("layout_regions")
        .insert(params)
        .select("*, media:media_id(id, name, type, url)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layout_regions", layoutId] }),
  });

  const updateRegion = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; x?: number; y?: number; width?: number; height?: number; name?: string; media_id?: string | null; z_index?: number; widget_type?: string | null; widget_config?: any }) => {
      const { error } = await supabase.from("layout_regions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layout_regions", layoutId] }),
  });

  const deleteRegion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("layout_regions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layout_regions", layoutId] }),
  });

  return { regions, isLoading, addRegion, updateRegion, deleteRegion };
}
