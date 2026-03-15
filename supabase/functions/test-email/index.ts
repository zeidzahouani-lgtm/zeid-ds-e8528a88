import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function testConnection(host: string, port: number, useTls: boolean, expectedPattern: RegExp, label: string): Promise<Response> {
  try {
    let conn: Deno.Conn;
    if (useTls) {
      conn = await Deno.connectTls({ hostname: host, port });
    } else {
      conn = await Deno.connect({ hostname: host, port });
    }

    const buf = new Uint8Array(2048);
    const n = await conn.read(buf);
    const greeting = n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    conn.close();

    const success = expectedPattern.test(greeting);
    return new Response(JSON.stringify({
      success: true,
      message: success
        ? `Connexion ${label} réussie à ${host}:${port}${useTls ? " (TLS)" : ""}. Réponse: ${greeting.trim().slice(0, 120)}`
        : `Connexion TCP établie à ${host}:${port} mais réponse inattendue. Le serveur est joignable.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Impossible de se connecter à ${host}:${port}${useTls ? " (TLS)" : ""} — ${e.message}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, config } = await req.json();

    if (!type || !config) {
      return new Response(JSON.stringify({ error: "type et config sont requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "imap") {
      const host = config.imap_host;
      const port = parseInt(config.imap_port || "993");
      const useTls = port === 993 || config.imap_tls === true;

      if (!host) {
        return new Response(JSON.stringify({ error: "Serveur IMAP non configuré" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return await testConnection(host, port, useTls, /OK|\*/i, "IMAP");
    }

    if (type === "smtp") {
      const host = config.smtp_host;
      const port = parseInt(config.smtp_port || "587");
      const useTls = port === 465 || config.smtp_tls === true;

      if (!host) {
        return new Response(JSON.stringify({ error: "Serveur SMTP non configuré" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return await testConnection(host, port, useTls, /220/, "SMTP");
    }

    return new Response(JSON.stringify({ error: "Type invalide. Utilisez 'imap' ou 'smtp'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
