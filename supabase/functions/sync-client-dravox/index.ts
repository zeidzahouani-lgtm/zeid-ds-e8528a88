import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORT_DRAVOX_URL = "https://okgmecbjvtmbzuyqwruu.supabase.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check - only admins or service role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const dravoxServiceKey = Deno.env.get("SUPPORT_DRAVOX_SERVICE_ROLE_KEY");

    if (!dravoxServiceKey) throw new Error("SUPPORT_DRAVOX_SERVICE_ROLE_KEY not configured");

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

    const dravoxClient = createClient(SUPPORT_DRAVOX_URL, dravoxServiceKey);

    // Check mode: just return which emails exist in support-dravox
    if (mode === "check") {
      const emails = users.map((u: any) => u.email).filter(Boolean);
      const { data: existingClients } = await dravoxClient
        .from("clients")
        .select("email")
        .in("email", emails);

      const syncedEmails = (existingClients || []).map((c: any) => c.email);
      return new Response(JSON.stringify({ success: true, syncedEmails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync mode
    const results: any[] = [];

    for (const u of users) {
      try {
        const { data: existing } = await dravoxClient
          .from("clients")
          .select("id")
          .eq("email", u.email)
          .maybeSingle();

        let clientId: string;

        if (existing) {
          clientId = existing.id;
          await dravoxClient.from("clients").update({
            nom: u.display_name || u.email.split("@")[0],
            societe: u.establishment_name || "",
            telephone: u.phone || "",
            adresse: u.address || "",
            matricule_fiscal: u.matricule_fiscal || "",
            registre_commerce: u.registre_commerce || "",
            code_tva: u.code_tva || "",
            code_categorie: u.code_categorie || "",
            secteur_activite: u.secteur_activite || "",
          }).eq("id", clientId);
          results.push({ email: u.email, action: "updated", clientId });
        } else {
          const { data: newClient, error: clientError } = await dravoxClient
            .from("clients")
            .insert({
              nom: u.display_name || u.email.split("@")[0],
              email: u.email,
              societe: u.establishment_name || "",
              telephone: u.phone || "",
              adresse: u.address || "",
              matricule_fiscal: u.matricule_fiscal || "",
              registre_commerce: u.registre_commerce || "",
              code_tva: u.code_tva || "",
              code_categorie: u.code_categorie || "",
              secteur_activite: u.secteur_activite || "",
            })
            .select("id")
            .single();
          if (clientError) throw clientError;
          clientId = newClient.id;
          results.push({ email: u.email, action: "created", clientId });
        }

        const { data: existingVault } = await dravoxClient
          .from("vault_entries")
          .select("id")
          .eq("client_id", clientId)
          .eq("nom", "ScreenFlow")
          .maybeSingle();

        if (!existingVault) {
          await dravoxClient.from("vault_entries").insert({
            nom: "ScreenFlow",
            client_id: clientId,
            type_equipement: "serveur",
            identifiant: u.email,
            notes: `Compte ScreenFlow - ${u.establishment_name || ""}`.trim(),
          });
        }
      } catch (err: any) {
        results.push({ email: u.email, action: "error", error: err.message });
      }
    }

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
