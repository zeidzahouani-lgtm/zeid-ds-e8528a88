// Public edge function to bootstrap the very first admin account.
// SECURITY: Only works while NO admin exists in the database.
// Once a single admin is present, this endpoint refuses all requests.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { user_id, email, action } = body as {
      user_id?: string;
      email?: string;
      action?: "check" | "promote";
    };

    // 1. Check if any admin already exists
    const { count, error: countErr } = await admin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw countErr;

    const hasAdmin = (count ?? 0) > 0;

    if (action === "check") {
      return new Response(JSON.stringify({ has_admin: hasAdmin }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Promote action — only allowed when no admin exists
    if (hasAdmin) {
      return new Response(
        JSON.stringify({
          error: "Un compte administrateur existe déjà. Cette action est désactivée.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!user_id && !email) {
      return new Response(JSON.stringify({ error: "user_id ou email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user_id from email if needed
    let targetId = user_id;
    if (!targetId && email) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers();
      if (listErr) throw listErr;
      const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) {
        return new Response(JSON.stringify({ error: "Utilisateur introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetId = found.id;

      // Auto-confirm email so they can log in immediately
      if (!found.email_confirmed_at) {
        await admin.auth.admin.updateUserById(targetId, { email_confirm: true });
      }
    }

    // 3. Insert admin role (idempotent)
    const { error: insErr } = await admin
      .from("user_roles")
      .upsert({ user_id: targetId, role: "admin" }, { onConflict: "user_id,role" });
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, user_id: targetId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bootstrap-admin error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
