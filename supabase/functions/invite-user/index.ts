import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Allow service role to bypass admin check
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const token = authHeader.replace("Bearer ", "");
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      
      // Use getClaims for ES256 token validation
      const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");
      
      const userId = claimsData.claims.sub;

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
      if (!roleData || roleData.length === 0) throw new Error("Not admin");
    }

    const { email, password, display_name, update_password } = await req.json();
    if (!email || !password) throw new Error("Email and password required");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (update_password) {
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) throw listError;

      const targetUser = users.find((u: any) => u.email === email);
      if (!targetUser) throw new Error("Utilisateur introuvable");

      const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
        password,
      });
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, user: targetUser }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new user
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || email.split("@")[0] },
    });

    if (error) throw error;

    // Sync to support-dravox (fire and forget)
    try {
      const dravoxServiceKey = Deno.env.get("SUPPORT_DRAVOX_SERVICE_ROLE_KEY");
      if (dravoxServiceKey) {
        const { createClient: createDravoxClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const dravoxClient = createDravoxClient("https://okgmecbjvtmbzuyqwruu.supabase.co", dravoxServiceKey);

        // Check if client exists
        const { data: existing } = await dravoxClient
          .from("clients")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        let clientId: string;
        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient } = await dravoxClient
            .from("clients")
            .insert({
              nom: display_name || email.split("@")[0],
              email,
            })
            .select("id")
            .single();
          clientId = newClient?.id;
        }

        if (clientId) {
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
              identifiant: email,
            });
          }
        }
      }
    } catch (syncErr) {
      console.error("Sync to support-dravox failed:", syncErr);
    }

    return new Response(JSON.stringify({ user: data.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
