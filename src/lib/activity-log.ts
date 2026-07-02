import { supabase } from "@/integrations/supabase/client";

export interface ActivityLogInput {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  description?: string | null;
  establishment_id?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Enregistre une action dans le journal d'activité.
 * Silencieux en cas d'erreur pour ne jamais bloquer le flux utilisateur.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action: input.action,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      description: input.description ?? null,
      establishment_id: input.establishment_id ?? null,
      metadata: input.metadata ?? {},
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };
    await (supabase.from("activity_logs" as any) as any).insert(payload);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[activity-log] failed", e);
  }
}
