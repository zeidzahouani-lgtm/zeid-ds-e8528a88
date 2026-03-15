import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, image_url, schedule_start, schedule_end, screen_id, title, metadata } = body;

    if (!image_url) {
      return new Response(JSON.stringify({ error: "image_url est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine status based on action
    let status: string = "pending";
    if (action === "schedule" && schedule_start && schedule_end) {
      status = "scheduled";
    } else if (action === "activate") {
      status = "active";
    }

    const insertData: Record<string, unknown> = {
      image_url,
      status,
      title: title || `Contenu reçu ${new Date().toLocaleString("fr-FR")}`,
      source: "webhook",
      metadata: metadata || null,
    };

    if (schedule_start) insertData.start_time = schedule_start;
    if (schedule_end) insertData.end_time = schedule_end;
    if (screen_id) insertData.screen_id = screen_id;

    const { data, error } = await supabase.from("contents").insert(insertData).select().single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Content created: ${data.id} (status: ${status})`);

    return new Response(JSON.stringify({ success: true, content: data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("content-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
