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
  source: string;
  establishment_id: string | null;
  establishment_name?: string;
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
        .from("licenses")
        .select("*, establishment:establishments(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((l: any) => ({
        ...l,
        establishment_name: l.establishment?.name || null,
      })) as unknown as License[];
    },
  });

  const createLicense = useMutation({
    mutationFn: async ({ screenId, durationDays, establishmentId }: { screenId?: string; durationDays: number; establishmentId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + durationDays);

      const { error } = await supabase
        .from("licenses")
        .insert({
          license_key: generateLicenseKey(),
          screen_id: screenId || null,
          created_by: user.id,
          valid_until: validUntil.toISOString(),
          is_active: true,
          establishment_id: establishmentId || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const toggleLicense = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("licenses")
        .update({ is_active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const deleteLicense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("licenses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const assignScreen = useMutation({
    mutationFn: async ({ id, screen_id }: { id: string; screen_id: string }) => {
      const { error } = await supabase
        .from("licenses")
        .update({ screen_id, activated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const renewLicense = useMutation({
    mutationFn: async ({ id, durationDays }: { id: string; durationDays: number }) => {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + durationDays);
      const { error } = await supabase
        .from("licenses")
        .update({ valid_until: validUntil.toISOString(), is_active: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["licenses"] }),
  });

  return { licenses, isLoading, createLicense, toggleLicense, deleteLicense, assignScreen, renewLicense };
}

// Validate a license key for a specific screen (used by Player)
// `transient: true` signals a network/RPC error (not an actual invalid license):
// callers should preserve their previous state instead of flipping to "invalid".
export async function validateLicense(
  screenId: string,
): Promise<{ valid: boolean; message?: string; transient?: boolean }> {
  try {
    const { data, error } = await (supabase as any).rpc("validate_license_for_screen", {
      _screen_id: screenId,
    });
    if (error) return { valid: false, message: "Erreur de validation", transient: true };
    const result = Array.isArray(data) ? data[0] : data;
    if (result === undefined || result === null) {
      return { valid: false, message: "Réponse vide", transient: true };
    }
    return {
      valid: !!result?.valid,
      message: result?.message ?? undefined,
    };
  } catch (_e) {
    return { valid: false, message: "Erreur réseau", transient: true };
  }
}

// Activate a license by key for a specific screen (used by Player manual entry)
export async function activateLicenseByKey(licenseKey: string, screenId: string): Promise<{ valid: boolean; message?: string }> {
  const { data, error } = await (supabase as any).rpc("activate_license_by_key", {
    _license_key: licenseKey,
    _screen_id: screenId,
  });

  if (error) return { valid: false, message: "Erreur lors de l'activation" };

  const result = Array.isArray(data) ? data[0] : data;
  return {
    valid: !!result?.valid,
    message: result?.message ?? undefined,
  };
}
