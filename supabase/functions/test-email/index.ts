import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function testImplicitTls(host: string, port: number, expectedPattern: RegExp, label: string): Promise<Response> {
  try {
    const conn = await Deno.connectTls({ hostname: host, port });
    const buf = new Uint8Array(2048);
    const n = await conn.read(buf);
    const greeting = n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    conn.close();

    const success = expectedPattern.test(greeting);
    return new Response(JSON.stringify({
      success: true,
      message: success
        ? `Connexion ${label} réussie à ${host}:${port} (TLS). Réponse: ${greeting.trim().slice(0, 120)}`
        : `Connexion TCP établie à ${host}:${port} mais réponse inattendue. Le serveur est joignable.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Impossible de se connecter à ${host}:${port} (TLS) — ${e.message}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

async function testStartTls(host: string, port: number, label: string): Promise<Response> {
  try {
    // Step 1: Plain TCP connection
    const conn = await Deno.connect({ hostname: host, port });

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };
    const write = async (cmd: string) => {
      await conn.write(new TextEncoder().encode(cmd + "\r\n"));
    };

    // Step 2: Read greeting
    const greeting = await read();
    if (!/220/.test(greeting)) {
      conn.close();
      return new Response(JSON.stringify({
        success: false,
        error: `${label} greeting inattendu sur ${host}:${port}: ${greeting.trim().slice(0, 120)}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 3: Send EHLO
    await write(`EHLO test.local`);
    const ehloResp = await read();

    // Step 4: Attempt STARTTLS
    if (ehloResp.toUpperCase().includes("STARTTLS")) {
      await write("STARTTLS");
      const starttlsResp = await read();

      if (/220/.test(starttlsResp)) {
        // Step 5: Upgrade to TLS
        const tlsConn = await Deno.startTls(conn, { hostname: host });
        tlsConn.close();

        return new Response(JSON.stringify({
          success: true,
          message: `Connexion ${label} réussie à ${host}:${port} (STARTTLS). Le serveur supporte le chiffrement.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        conn.close();
        return new Response(JSON.stringify({
          success: false,
          error: `STARTTLS refusé par ${host}:${port}: ${starttlsResp.trim().slice(0, 120)}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // No STARTTLS but server responded — plain connection works
    conn.close();
    return new Response(JSON.stringify({
      success: true,
      message: `Connexion ${label} réussie à ${host}:${port} (non chiffré). STARTTLS non disponible.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Impossible de se connecter à ${host}:${port} (STARTTLS) — ${e.message}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

async function testPlain(host: string, port: number, expectedPattern: RegExp, label: string): Promise<Response> {
  try {
    const conn = await Deno.connect({ hostname: host, port });
    const buf = new Uint8Array(2048);
    const n = await conn.read(buf);
    const greeting = n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    conn.close();

    const success = expectedPattern.test(greeting);
    return new Response(JSON.stringify({
      success: true,
      message: success
        ? `Connexion ${label} réussie à ${host}:${port}. Réponse: ${greeting.trim().slice(0, 120)}`
        : `Connexion TCP établie à ${host}:${port} mais réponse inattendue.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Impossible de se connecter à ${host}:${port} — ${e.message}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, config } = await req.json();

    if (!type || !config) {
      return new Response(JSON.stringify({ error: "type et config sont requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "imap") {
      const host = config.imap_host;
      const port = parseInt(config.imap_port || "993");
      if (!host) {
        return new Response(JSON.stringify({ error: "Serveur IMAP non configuré" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Port 993 = implicit TLS, others = plain
      if (port === 993) {
        return await testImplicitTls(host, port, /OK|\*/i, "IMAP");
      }
      return await testPlain(host, port, /OK|\*/i, "IMAP");
    }

    if (type === "smtp") {
      const host = config.smtp_host;
      const port = parseInt(config.smtp_port || "587");
      if (!host) {
        return new Response(JSON.stringify({ error: "Serveur SMTP non configuré" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Port 465 = implicit TLS, port 587/25 = STARTTLS
      if (port === 465) {
        return await testImplicitTls(host, port, /220/, "SMTP");
      }
      return await testStartTls(host, port, "SMTP");
    }

    return new Response(JSON.stringify({ error: "Type invalide. Utilisez 'imap' ou 'smtp'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
