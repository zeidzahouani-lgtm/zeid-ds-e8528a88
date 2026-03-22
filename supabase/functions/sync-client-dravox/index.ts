import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = "https://okgmecbjvtmbzuyqwruu.supabase.co/functions/v1/receive-screenflow-data";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const webhookSecret = Deno.env.get("DEVIS_WEBHOOK_SECRET");

    if (!webhookSecret) throw new Error("DEVIS_WEBHOOK_SECRET not configured");

    // Auth check
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    if (!isServiceRole) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");

      const userId = claimsData.claims.sub;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
      if (!roleData || roleData.length === 0) throw new Error("Not admin");
    }

    const { users, mode } = await req.json();
    if (!Array.isArray(users) || users.length === 0) throw new Error("No users provided");

    // Check mode: send each user as a "client" type to the webhook and see if they exist
    if (mode === "check") {
      const syncedEmails: string[] = [];
      for (const u of users) {
        if (!u.email) continue;
        try {
          // Try to send as client - if it returns "updated", the client exists
          const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": webhookSecret,
            },
            body: JSON.stringify({
              type: "client",
              nom: u.display_name || u.email.split("@")[0],
              email: u.email,
              societe: u.establishment_name || "",
            }),
          });
          const data = await res.json();
          if (data.success && (data.action === "created" || data.action === "updated")) {
            syncedEmails.push(u.email);
          }
        } catch {
          // skip
        }
      }
      return new Response(JSON.stringify({ success: true, syncedEmails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync mode - send clients via batch
    const clientsPayload = users.map((u: any) => ({
      nom: u.display_name || u.email?.split("@")[0] || "",
      email: u.email || "",
      societe: u.establishment_name || "",
      telephone: u.phone || "",
      adresse: u.address || "",
      matricule_fiscal: u.matricule_fiscal || "",
      registre_commerce: u.registre_commerce || "",
      code_tva: u.code_tva || "",
      code_categorie: u.code_categorie || "",
      secteur_activite: u.secteur_activite || "",
      notes: `Compte ScreenFlow - ${u.establishment_name || ""}`.trim(),
    }));

    // Send as batch
    const batchRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify({
        type: "batch",
        clients: clientsPayload,
        vault_entries: [],
      }),
    });

    const batchData = await batchRes.json();

    if (!batchRes.ok) {
      throw new Error(batchData.error || `Webhook returned ${batchRes.status}`);
    }

    // After batch sync, create vault entries for each client
    const vaultResults: any[] = [];
    for (const u of users) {
      if (!u.email) continue;
      try {
        const vaultRes = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": webhookSecret,
          },
          body: JSON.stringify({
            type: "vault",
            nom: "ScreenFlow",
            client_email: u.email,
            type_equipement: "serveur",
            identifiant: u.email,
            notes: `Compte ScreenFlow - ${u.establishment_name || ""}`.trim(),
          }),
        });
        const vaultData = await vaultRes.json();
        vaultResults.push({ email: u.email, vault: vaultData });
      } catch {
        // skip vault errors
      }
    }

    // Build results from batch response
    const results = batchData.results || clientsPayload.map((c: any, i: number) => ({
      email: users[i]?.email || "",
      action: "synced",
    }));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
