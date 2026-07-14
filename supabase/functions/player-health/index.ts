import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase.rpc("player_health_snapshot");
    if (error) throw error;

    const snapshot = data as {
      status: "healthy" | "degraded" | "unhealthy";
      errors: { last_1h: number };
      screens: { total: number; online: number };
    };

    // failure_rate_1h = errors per screen in the last hour
    const failureRate =
      snapshot.screens.total > 0
        ? +(snapshot.errors.last_1h / snapshot.screens.total).toFixed(2)
        : 0;

    const body = { ...snapshot, failure_rate_per_screen_1h: failureRate };

    // HTTP status mirrors health so external uptime monitors can trigger alerts
    const httpStatus = snapshot.status === "unhealthy" ? 503 : 200;

    return new Response(JSON.stringify(body, null, 2), {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("player-health error:", err);
    return new Response(
      JSON.stringify({ status: "unhealthy", error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
