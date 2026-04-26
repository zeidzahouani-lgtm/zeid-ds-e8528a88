import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = new Set([
  "profiles", "user_roles", "user_establishments", "establishments", "establishment_settings",
  "screens", "media", "playlists", "playlist_items", "programs", "schedules",
  "layouts", "layout_regions", "video_walls", "licenses", "contents",
  "notifications", "app_settings", "access_codes", "ai_requests",
  "registration_requests", "password_reset_requests", "inbox_emails", "email_actions",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin0 = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");

    // Bootstrap mode: allow unauthenticated restore ONLY when no admin exists yet.
    // This is used by the public login page to seed an empty instance from a JSON backup.
    let isBootstrap = false;
    if (!authHeader) {
      const { count } = await admin0
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) > 0) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isBootstrap = true;
    } else {
      // Standard path: verify caller is global admin
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleCheck } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { tables, mode = "upsert" } = body as { tables: Record<string, any[]>; mode?: "upsert" | "insert" };

    if (!tables || typeof tables !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = admin0;
    const results: Record<string, { ok: boolean; count: number; error?: string }> = {};
    if (isBootstrap) console.log("[restore-backup] bootstrap mode (no admin yet)");

    for (const [table, rows] of Object.entries(tables)) {
      if (!ALLOWED_TABLES.has(table)) {
        results[table] = { ok: false, count: 0, error: "Table not allowed" };
        continue;
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        results[table] = { ok: true, count: 0 };
        continue;
      }
      try {
        const query = mode === "upsert"
          ? admin.from(table).upsert(rows, { onConflict: "id" })
          : admin.from(table).insert(rows);
        const { error } = await query;
        if (error) {
          results[table] = { ok: false, count: 0, error: error.message };
        } else {
          results[table] = { ok: true, count: rows.length };
        }
      } catch (e: any) {
        results[table] = { ok: false, count: 0, error: e.message };
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[restore-backup]", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
