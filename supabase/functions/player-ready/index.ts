// Readiness probe — separate from /player-health (liveness + health metrics).
// Reports whether critical dependencies are reachable RIGHT NOW:
//  - Supabase Postgres (via a trivial SELECT)
//  - Anonymous RPC surface used by players (`resolve_player_screen`)
//  - Metrics/error collection RPCs (`log_player_metric`, `player_health_snapshot`)
//
// Returns HTTP 200 when every check passes ("ready"), 503 otherwise ("not_ready").
// Suitable for k8s-style readinessProbe or load-balancer traffic gating.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type CheckResult = {
  name: string;
  ok: boolean;
  latency_ms: number;
  error?: string;
};

async function timed(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = performance.now();
  try {
    await fn();
    return { name, ok: true, latency_ms: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      name,
      ok: false,
      latency_ms: Math.round(performance.now() - start),
      error: (err as Error).message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !serviceKey || !anonKey) {
    return new Response(
      JSON.stringify({
        status: "not_ready",
        error: "Missing Supabase environment variables",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Anon client to prove the *public* player surface is reachable — this is
  // the surface real Smart-TV players use, so it must work independently of
  // service-role credentials.
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  const checks: CheckResult[] = await Promise.all([
    // 1. Database connectivity via a lightweight query.
    timed("database", async () => {
      const { error } = await admin.from("screens").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw error;
    }),
    // 2. Player-facing screen resolution RPC (anon).
    timed("rpc_resolve_player_screen", async () => {
      const { error } = await anon.rpc("resolve_player_screen", { _screen_key: "__readiness_probe__" });
      if (error) throw error;
    }),
    // 3. Metrics collection RPC (anon) — reachability probe only.
    //    _load_ms=-1 is rejected upstream, so the RPC executes end-to-end
    //    without inserting a row (avoids polluting player_metrics).
    timed("rpc_log_player_metric", async () => {
      const { error } = await anon.rpc("log_player_metric", {
        _screen_key: "__readiness_probe__",
        _load_ms: -1,
        _ttfp_ms: null,
      });
      if (error) throw error;
    }),
    // 4. Aggregated health snapshot RPC (service role) — proves the
    //    metrics/errors aggregation path used by /player-health works.
    timed("rpc_player_health_snapshot", async () => {
      const { error } = await admin.rpc("player_health_snapshot");
      if (error) throw error;
    }),
  ]);

  const allOk = checks.every((c) => c.ok);
  const okCount = checks.filter((c) => c.ok).length;
  const httpStatus = allOk ? 200 : 503;
  const body = {
    status: allOk ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
  };

  // Persist snapshot for the 24h history chart (best-effort, never blocks the response).
  try {
    await admin.from("player_readiness_history").insert({
      status: body.status,
      http_status: httpStatus,
      checks_ok: okCount,
      checks_total: checks.length,
      checks,
    });
  } catch (_) {
    // ignore — readiness must not fail because of logging issues
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: httpStatus,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});

