import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Use getClaims for ES256 token validation
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Non authentifié");
    
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
    if (!roleData || roleData.length === 0) throw new Error("Non admin");

    const { to_email, to_name, password, type } = await req.json();
    if (!to_email || !password || !type) throw new Error("to_email, password et type requis");

    // Load SMTP config
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: settings } = await supabase.from("app_settings").select("key, value").like("key", "email_%");
    const cfg: Record<string, string> = {};
    (settings || []).forEach((r: any) => { cfg[r.key] = r.value || ""; });

    const { data: appSettings } = await supabase.from("app_settings").select("key, value").in("key", ["app_name", "logo_url"]);
    const appCfg: Record<string, string> = {};
    (appSettings || []).forEach((r: any) => { appCfg[r.key] = r.value || ""; });
    const appName = appCfg.app_name || "SignageOS";

    const smtpHost = cfg.email_smtp_host;
    const smtpPort = parseInt(cfg.email_smtp_port || "587");
    const smtpUser = cfg.email_smtp_user;
    const smtpPass = cfg.email_smtp_password;
    const fromName = cfg.email_from_name || appName;
    const fromEmail = cfg.email_from_email || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP non configuré. Veuillez configurer les paramètres email dans Administration > Email.");
    }

    const displayName = to_name || to_email.split("@")[0];

    let subject: string;
    let heading: string;
    let intro: string;

    if (type === "registration") {
      subject = `Bienvenue sur ${appName} — Vos identifiants de connexion`;
      heading = `Bienvenue sur ${appName} !`;
      intro = `Bonjour ${displayName},<br><br>Votre demande d'inscription a été <strong>approuvée</strong>. Voici vos identifiants de connexion :`;
    } else {
      subject = `${appName} — Votre nouveau mot de passe`;
      heading = `Réinitialisation du mot de passe`;
      intro = `Bonjour ${displayName},<br><br>Votre mot de passe a été réinitialisé par un administrateur. Voici vos nouveaux identifiants :`;
    }

    const htmlBody = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="background:linear-gradient(135deg,#111118 0%,#1a1a2e 100%);border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 32px rgba(0,0,0,0.4);">
    <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">${heading}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#cbd5e1;font-size:14px;line-height:1.7;margin:0 0 24px;">${intro}</p>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#94a3b8;font-size:13px;width:100px;">Email</td>
            <td style="padding:8px 0;color:#f1f5f9;font-size:14px;font-weight:600;">${to_email}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Mot de passe</td>
            <td style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);">
              <code style="background:rgba(14,165,233,0.1);color:#38bdf8;padding:6px 14px;border-radius:6px;font-size:15px;font-weight:700;letter-spacing:1px;">${password}</code>
            </td>
          </tr>
        </table>
      </div>
      <p style="color:#f59e0b;font-size:13px;line-height:1.6;margin:0 0 24px;padding:12px 16px;background:rgba(245,158,11,0.08);border-radius:8px;border-left:3px solid #f59e0b;">
        ⚠️ Pour votre sécurité, nous vous recommandons de changer votre mot de passe après votre première connexion.
      </p>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
        Si vous n'êtes pas à l'origine de cette demande, veuillez contacter votre administrateur.
      </p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="color:#475569;font-size:11px;margin:0;">${appName} — Système d'affichage dynamique</p>
    </div>
  </div>
</div>
</body>
</html>`;

    const textBody = type === "registration"
      ? `Bienvenue sur ${appName}!\n\nVotre inscription a été approuvée.\nEmail: ${to_email}\nMot de passe: ${password}\n\nChangez votre mot de passe après connexion.`
      : `Votre mot de passe ${appName} a été réinitialisé.\nEmail: ${to_email}\nNouveau mot de passe: ${password}\n\nChangez votre mot de passe après connexion.`;

    let finalConn: Deno.Conn;
    if (smtpPort === 465) {
      finalConn = await Deno.connectTls({ hostname: smtpHost, port: smtpPort });
    } else if (smtpPort === 587) {
      const tcpConn = await Deno.connect({ hostname: smtpHost, port: smtpPort });
      const tcpRead = async () => { const buf = new Uint8Array(4096); const n = await tcpConn.read(buf); return n ? new TextDecoder().decode(buf.subarray(0, n)) : ""; };
      const tcpWrite = async (cmd: string) => { await tcpConn.write(new TextEncoder().encode(cmd + "\r\n")); return await tcpRead(); };
      await tcpRead();
      await tcpWrite("EHLO localhost");
      const tlsResp = await tcpWrite("STARTTLS");
      if (!tlsResp.includes("220")) throw new Error("STARTTLS refused");
      finalConn = await Deno.startTls(tcpConn, { hostname: smtpHost });
    } else {
      finalConn = await Deno.connect({ hostname: smtpHost, port: smtpPort });
    }

    const read = async () => { const buf = new Uint8Array(4096); const n = await finalConn.read(buf); return n ? new TextDecoder().decode(buf.subarray(0, n)) : ""; };
    const write = async (cmd: string) => { await finalConn.write(new TextEncoder().encode(cmd + "\r\n")); return await read(); };

    if (smtpPort !== 587) await read();
    await write("EHLO localhost");
    await write(`AUTH PLAIN ${btoa(`\0${smtpUser}\0${smtpPass}`)}`);
    await write(`MAIL FROM:<${fromEmail}>`);
    await write(`RCPT TO:<${to_email}>`);
    await write("DATA");

    const boundary = `b_${Date.now()}`;
    const msg = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: ${to_email}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    await write(msg);
    await write("QUIT");
    finalConn.close();

    console.log(`Credentials email sent to ${to_email} (type: ${type})`);

    return new Response(JSON.stringify({ success: true, message: `Email envoyé à ${to_email}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-credentials error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
