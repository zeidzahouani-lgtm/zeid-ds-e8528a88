import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

      if (!host) {
        return new Response(JSON.stringify({ error: "Serveur IMAP non configuré" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Test TCP connection to IMAP server
      try {
        const conn = await Deno.connect({ hostname: host, port });
        const buf = new Uint8Array(1024);
        const n = await conn.read(buf);
        const greeting = n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
        conn.close();

        if (greeting.includes("OK") || greeting.includes("*")) {
          return new Response(JSON.stringify({
            success: true,
            message: `Connexion IMAP réussie à ${host}:${port}. Réponse: ${greeting.trim().slice(0, 100)}`,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          return new Response(JSON.stringify({
            success: true,
            message: `Connexion TCP établie à ${host}:${port} mais réponse inattendue. Le serveur est joignable.`,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({
          error: `Impossible de se connecter à ${host}:${port} — ${e.message}`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (type === "smtp") {
      const host = config.smtp_host;
      const port = parseInt(config.smtp_port || "587");

      if (!host) {
        return new Response(JSON.stringify({ error: "Serveur SMTP non configuré" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const conn = await Deno.connect({ hostname: host, port });
        const buf = new Uint8Array(1024);
        const n = await conn.read(buf);
        const greeting = n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
        conn.close();

        if (greeting.includes("220")) {
          return new Response(JSON.stringify({
            success: true,
            message: `Connexion SMTP réussie à ${host}:${port}. Réponse: ${greeting.trim().slice(0, 100)}`,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          return new Response(JSON.stringify({
            success: true,
            message: `Connexion TCP établie à ${host}:${port}. Le serveur est joignable.`,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({
          error: `Impossible de se connecter à ${host}:${port} — ${e.message}`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
