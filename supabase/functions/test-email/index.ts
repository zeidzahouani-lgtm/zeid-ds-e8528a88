import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- OAuth2 helper: get access token via client credentials ---
async function getOAuth2Token(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://outlook.office365.com/.default",
  });
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "OAuth2 token request failed");
  }
  return data.access_token;
}

function buildXOAuth2Token(user: string, accessToken: string): string {
  const str = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
  return btoa(str);
}

// --- Test with actual authentication ---
async function testImapAuth(host: string, port: number, user: string, password: string, authMethod: string, oauthConfig?: { tenant_id: string; client_id: string; client_secret: string }): Promise<Response> {
  try {
    let conn: Deno.Conn;
    if (port === 993) {
      conn = await Deno.connectTls({ hostname: host, port });
    } else {
      conn = await Deno.connect({ hostname: host, port });
    }

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };

    let tagCounter = 0;
    const cmd = async (command: string): Promise<string> => {
      const tag = `T${++tagCounter}`;
      await conn.write(new TextEncoder().encode(`${tag} ${command}\r\n`));
      let response = "";
      let attempts = 0;
      while (attempts < 30) {
        const chunk = await read();
        response += chunk;
        if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) break;
        attempts++;
      }
      return response;
    };

    // Read greeting
    const greeting = await read();

    let loginResp: string;
    if (authMethod === "oauth2" && oauthConfig) {
      // Get OAuth2 token and use XOAUTH2
      const accessToken = await getOAuth2Token(oauthConfig.tenant_id, oauthConfig.client_id, oauthConfig.client_secret);
      const xoauth2Token = buildXOAuth2Token(user, accessToken);
      loginResp = await cmd(`AUTHENTICATE XOAUTH2 ${xoauth2Token}`);
    } else {
      loginResp = await cmd(`LOGIN "${user}" "${password}"`);
    }

    if (loginResp.includes("OK")) {
      await cmd("LOGOUT");
      conn.close();
      return new Response(JSON.stringify({
        success: true,
        message: `Connexion IMAP réussie à ${host}:${port} (${authMethod === "oauth2" ? "OAuth2/XOAUTH2" : "mot de passe"}). Authentification validée ✅`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      conn.close();
      const detail = loginResp.trim().slice(0, 200);
      return new Response(JSON.stringify({
        success: false,
        error: `Échec d'authentification IMAP sur ${host}:${port} (${authMethod === "oauth2" ? "OAuth2" : "basique"}). Réponse: ${detail}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Erreur IMAP ${host}:${port} — ${e.message}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

async function testSmtpAuth(host: string, port: number, user: string, password: string, authMethod: string, oauthConfig?: { tenant_id: string; client_id: string; client_secret: string }): Promise<Response> {
  try {
    let finalConn: Deno.Conn;

    if (port === 465) {
      finalConn = await Deno.connectTls({ hostname: host, port });
    } else {
      // STARTTLS for port 587/25
      const tcpConn = await Deno.connect({ hostname: host, port });
      const tcpRead = async () => { const buf = new Uint8Array(4096); const n = await tcpConn.read(buf); return n ? new TextDecoder().decode(buf.subarray(0, n)) : ""; };
      const tcpWrite = async (cmd: string) => { await tcpConn.write(new TextEncoder().encode(cmd + "\r\n")); return await tcpRead(); };
      
      const greeting = await tcpRead();
      if (!/220/.test(greeting)) {
        tcpConn.close();
        return new Response(JSON.stringify({ success: false, error: `SMTP greeting inattendu: ${greeting.trim().slice(0, 120)}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      await tcpWrite("EHLO test.local");
      const starttlsResp = await tcpWrite("STARTTLS");
      if (/220/.test(starttlsResp)) {
        finalConn = await Deno.startTls(tcpConn, { hostname: host });
      } else {
        // No STARTTLS, continue plain
        finalConn = tcpConn as any;
      }
    }

    const read = async () => { const buf = new Uint8Array(4096); const n = await finalConn.read(buf); return n ? new TextDecoder().decode(buf.subarray(0, n)) : ""; };
    const write = async (cmd: string) => { await finalConn.write(new TextEncoder().encode(cmd + "\r\n")); return await read(); };

    // Read greeting for 465 or post-STARTTLS
    if (port === 465) await read();
    await write("EHLO test.local");

    let authResp: string;
    if (authMethod === "oauth2" && oauthConfig) {
      const accessToken = await getOAuth2Token(oauthConfig.tenant_id, oauthConfig.client_id, oauthConfig.client_secret);
      const xoauth2Token = buildXOAuth2Token(user, accessToken);
      authResp = await write(`AUTH XOAUTH2 ${xoauth2Token}`);
    } else {
      authResp = await write(`AUTH PLAIN ${btoa(`\0${user}\0${password}`)}`);
    }

    if (authResp.includes("235")) {
      await write("QUIT");
      finalConn.close();
      return new Response(JSON.stringify({
        success: true,
        message: `Connexion SMTP réussie à ${host}:${port} (${authMethod === "oauth2" ? "OAuth2/XOAUTH2" : "mot de passe"}). Authentification validée ✅`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      finalConn.close();
      return new Response(JSON.stringify({
        success: false,
        error: `Échec d'authentification SMTP sur ${host}:${port} (${authMethod === "oauth2" ? "OAuth2" : "basique"}). Réponse: ${authResp.trim().slice(0, 200)}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Erreur SMTP ${host}:${port} — ${e.message}`,
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

    const authMethod = config.auth_method || "basic";
    const oauthConfig = authMethod === "oauth2" ? {
      tenant_id: config.oauth_tenant_id,
      client_id: config.oauth_client_id,
      client_secret: config.oauth_client_secret,
    } : undefined;

    if (type === "imap") {
      const host = config.imap_host;
      const port = parseInt(config.imap_port || "993");
      const user = config.imap_user;
      const password = config.imap_password;
      if (!host || !user) {
        return new Response(JSON.stringify({ error: "Serveur IMAP ou utilisateur non configuré" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (authMethod === "oauth2" && (!oauthConfig?.tenant_id || !oauthConfig?.client_id || !oauthConfig?.client_secret)) {
        return new Response(JSON.stringify({ error: "Configuration OAuth2 incomplète (Tenant ID, Client ID et Client Secret requis)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await testImapAuth(host, port, user, password, authMethod, oauthConfig);
    }

    if (type === "smtp") {
      const host = config.smtp_host;
      const port = parseInt(config.smtp_port || "587");
      const user = config.smtp_user;
      const password = config.smtp_password;
      if (!host || !user) {
        return new Response(JSON.stringify({ error: "Serveur SMTP ou utilisateur non configuré" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (authMethod === "oauth2" && (!oauthConfig?.tenant_id || !oauthConfig?.client_id || !oauthConfig?.client_secret)) {
        return new Response(JSON.stringify({ error: "Configuration OAuth2 incomplète (Tenant ID, Client ID et Client Secret requis)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await testSmtpAuth(host, port, user, password, authMethod, oauthConfig);
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
