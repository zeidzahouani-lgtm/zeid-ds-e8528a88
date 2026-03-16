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
      // Verify caller is admin
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (!caller) throw new Error("Not authenticated");

      const { data: roleData } = await callerClient.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin");
      if (!roleData || roleData.length === 0) throw new Error("Not admin");
    }

    const { email, password, display_name, update_password } = await req.json();
    if (!email || !password) throw new Error("Email and password required");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (update_password) {
      // Find user by email and update their password
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
