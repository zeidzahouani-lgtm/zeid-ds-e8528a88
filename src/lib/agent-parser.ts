/**
 * Parse and process JSON data from an AI agent or webhook
 * Expected format: { action, image_url, schedule_start, schedule_end, screen_id?, title? }
 */

import { supabase } from "@/integrations/supabase/client";

export interface AgentPayload {
  action: "schedule" | "activate" | "add";
  image_url: string;
  schedule_start?: string;
  schedule_end?: string;
  screen_id?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export function parseAgentPayload(raw: string | Record<string, unknown>): AgentPayload | null {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (!data.image_url) {
      console.error("Agent payload missing image_url");
      return null;
    }

    return {
      action: data.action || "add",
      image_url: data.image_url,
      schedule_start: data.schedule_start || undefined,
      schedule_end: data.schedule_end || undefined,
      screen_id: data.screen_id || undefined,
      title: data.title || undefined,
      metadata: data.metadata || undefined,
    };
  } catch (e) {
    console.error("Failed to parse agent payload:", e);
    return null;
  }
}

export async function submitAgentContent(payload: AgentPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("content-webhook", {
      body: payload,
    });

    if (error) return { success: false, error: error.message };
    if (data?.error) return { success: false, error: data.error };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Erreur inconnue" };
  }
}
