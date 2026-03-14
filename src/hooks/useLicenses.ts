import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface License {
  id: string;
  license_key: string;
  screen_id: string | null;
  created_by: string | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  activated_at: string | null;
  created_at: string;
}

function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = 4;
  const segLen = 4;
  const parts: string[] = [];
  for (let s = 0; s < segments; s++) {
    let seg = "";
    for (let i = 0; i < segLen; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    parts.push(seg);
  }
  return parts.join("-");
}

export function useLicenses() {
  const queryClient = useQueryClient();

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as License[];
    },
  });

  const createLicense = useMutation({
    mutationFn: async ({ screenId, durationDays }: { screenId?: string; durationDays: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + durationDays);

      const { error } = await supabase
        .from("licenses" as any)
        .insert({
          license_key: generateLicenseKey(),
          screen_id: screenId || null,
          created_by: user.id,
          valid_until: validUntil.toISOString(),
          is_active: true,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const toggleLicense = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("licenses" as any)
        .update({ is_active } as any)
        .eq("id", id as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const deleteLicense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("licenses" as any)
        .delete()
        .eq("id", id as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const assignScreen = useMutation({
    mutationFn: async ({ id, screen_id }: { id: string; screen_id: string }) => {
      const { error } = await supabase
        .from("licenses" as any)
        .update({ screen_id, activated_at: new Date().toISOString() } as any)
        .eq("id", id as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  return { licenses, isLoading, createLicense, toggleLicense, deleteLicense, assignScreen };
}

// Validate a license key for a specific screen (used by Player)
export async function validateLicense(screenId: string): Promise<{ valid: boolean; message?: string }> {
  const { data, error } = await supabase
    .from("licenses" as any)
    .select("*")
    .eq("screen_id", screenId as any)
    .eq("is_active", true as any);

  if (error) return { valid: false, message: "Erreur de validation" };

  const licenses = (data || []) as unknown as License[];
  if (licenses.length === 0) return { valid: false, message: "Aucune licence associée à cet écran" };

  const now = new Date();
  const validLicense = licenses.find(
    (l) => new Date(l.valid_from) <= now && new Date(l.valid_until) >= now
  );

  if (!validLicense) return { valid: false, message: "Licence expirée" };

  return { valid: true };
}
