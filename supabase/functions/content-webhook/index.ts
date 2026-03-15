import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendAckEmail(supabase: any, content: any, baseUrl: string) {
  // Load SMTP config from app_settings
  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .like("key", "email_%");

  const cfg: Record<string, string> = {};
  (settings || []).forEach((r: any) => { cfg[r.key] = r.value || ""; });

  const smtpHost = cfg.email_smtp_host;
  const smtpPort = parseInt(cfg.email_smtp_port || "587");
  const smtpUser = cfg.email_smtp_user;
  const smtpPass = cfg.email_smtp_password;
  const fromName = cfg.email_from_name || "Affichage Dynamique";
  const fromEmail = cfg.email_from_email || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log("SMTP not configured, skipping ACK email");
    return;
  }

  if (!content.sender_email) {
    console.log("No sender_email, skipping ACK email");
    return;
  }

  const token = content.confirmation_token;
  const validateUrl = `${baseUrl}/functions/v1/content-action?token=${token}&action=validate`;
  const cancelUrl = `${baseUrl}/functions/v1/content-action?token=${token}&action=cancel`;

  const statusLabel = content.status === "scheduled" ? "Programmé" : content.status === "active" ? "Activé immédiatement" : "En attente de validation";
  const startStr = content.start_time ? new Date(content.start_time).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "Non défini";
  const endStr = content.end_time ? new Date(content.end_time).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "Non défini";

  const subject = `[Accusé de réception] Contenu "${content.title}" — Réf: ${content.id.slice(0, 8).toUpperCase()}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f7;color:#333;">
  <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">📩 Accusé de réception</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Votre contenu a été reçu et enregistré</p>
    </div>
    
    <div style="padding:30px;">
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 20px;">Détails du contenu</h2>
      
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:140px;">Titre</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${content.title || "Sans titre"}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Référence</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace;">${content.id.slice(0, 8).toUpperCase()}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Statut</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${statusLabel}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Début de diffusion</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${startStr}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Fin de diffusion</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${endStr}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Écran cible</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${content.screen_id ? content.screen_id.slice(0, 8) : "Tous les écrans"}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Source</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${content.source || "webhook"}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Reçu le</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${new Date(content.created_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}</td></tr>
      </table>

      ${content.image_url ? `
      <div style="margin:20px 0;text-align:center;">
        <p style="font-size:13px;color:#64748b;margin:0 0 8px;">Aperçu du contenu :</p>
        <img src="${content.image_url}" alt="Aperçu" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid #e2e8f0;" />
      </div>` : ""}

      <h3 style="color:#1e293b;font-size:16px;margin:25px 0 15px;">🔧 Actions prévues</h3>
      <ul style="font-size:14px;line-height:1.8;color:#475569;padding-left:20px;">
        <li>Le contenu sera ${content.status === "active" ? "diffusé immédiatement" : content.status === "scheduled" ? "diffusé automatiquement selon le créneau programmé" : "soumis à validation manuelle avant diffusion"}</li>
        <li>L'image sera redimensionnée et optimisée pour l'affichage sur écran</li>
        ${content.screen_id ? "<li>Le contenu sera affiché sur l'écran assigné uniquement</li>" : "<li>Le contenu pourra être assigné à un écran spécifique depuis le tableau de bord</li>"}
        ${content.start_time && content.end_time ? "<li>La diffusion sera automatiquement activée et désactivée selon le créneau horaire défini</li>" : "<li>Aucun créneau horaire n'a été défini — le contenu sera diffusé en continu une fois validé</li>"}
      </ul>

      <div style="margin:30px 0;text-align:center;">
        <p style="font-size:14px;color:#475569;margin-bottom:15px;">Vous pouvez gérer ce contenu directement :</p>
        <a href="${validateUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:0 8px;">✅ Valider</a>
        <a href="${cancelUrl}" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:0 8px;">❌ Annuler</a>
      </div>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="font-size:13px;color:#0369a1;margin:0;line-height:1.6;">
          💡 <strong>Astuce :</strong> Vous pouvez aussi répondre directement à cet email avec le mot <strong>"valider"</strong> pour approuver ou <strong>"annuler"</strong> pour rejeter ce contenu.
        </p>
      </div>
    </div>
    
    <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">Cet email a été envoyé automatiquement par votre système d'affichage dynamique.</p>
      <p style="font-size:11px;color:#cbd5e1;margin:8px 0 0;">Réf: ${content.id} | Token: ${token?.slice(0, 8)}...</p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `Accusé de réception — Contenu "${content.title || "Sans titre"}"

Référence: ${content.id.slice(0, 8).toUpperCase()}
Statut: ${statusLabel}
Début: ${startStr}
Fin: ${endStr}
Écran: ${content.screen_id ? content.screen_id.slice(0, 8) : "Tous les écrans"}

Actions prévues:
- Le contenu sera ${content.status === "active" ? "diffusé immédiatement" : content.status === "scheduled" ? "diffusé selon le créneau" : "soumis à validation"}
- L'image sera optimisée pour l'affichage

Pour valider: ${validateUrl}
Pour annuler: ${cancelUrl}

Ou répondez à cet email avec "valider" ou "annuler".`;

  // Send via raw SMTP
  try {
    let finalConn: Deno.Conn;

    if (smtpPort === 465) {
      // Port 465 = SSL implicite → connectTls directement
      finalConn = await Deno.connectTls({ hostname: smtpHost, port: smtpPort });
    } else if (smtpPort === 587) {
      // Port 587 = STARTTLS → TCP puis upgrade TLS
      const tcpConn = await Deno.connect({ hostname: smtpHost, port: smtpPort });
      const tcpRead = async () => {
        const buf = new Uint8Array(4096);
        const n = await tcpConn.read(buf);
        return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
      };
      const tcpWrite = async (cmd: string) => {
        await tcpConn.write(new TextEncoder().encode(cmd + "\r\n"));
        return await tcpRead();
      };
      await tcpRead(); // greeting
      await tcpWrite("EHLO localhost");
      const tlsResp = await tcpWrite("STARTTLS");
      if (!tlsResp.includes("220")) throw new Error("STARTTLS refused: " + tlsResp);
      finalConn = await Deno.startTls(tcpConn, { hostname: smtpHost });
    } else {
      // Port 25 or other = plain TCP
      finalConn = await Deno.connect({ hostname: smtpHost, port: smtpPort });
    }

    const read = async () => {
      const buf = new Uint8Array(4096);
      const n = await finalConn.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };
    const write = async (cmd: string) => {
      await finalConn.write(new TextEncoder().encode(cmd + "\r\n"));
      return await read();
    };

    // Read greeting (for 465 and 25)
    if (smtpPort !== 587) await read();

    await write("EHLO localhost");

    // AUTH
    const credentials = btoa(`\0${smtpUser}\0${smtpPass}`);
    await write(`AUTH PLAIN ${credentials}`);

    await write(`MAIL FROM:<${fromEmail}>`);
    await write(`RCPT TO:<${content.sender_email}>`);
    await write("DATA");

    const boundary = `boundary_${Date.now()}`;
    const message = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: ${content.sender_email}`,
      `Subject: ${subject}`,
      `References: <content-${content.id}@signage>`,
      `Message-ID: <ack-${content.id}@signage>`,
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

    await write(message);
    await write("QUIT");
    finalConn.close();
    console.log(`ACK email sent to ${content.sender_email}`);
  } catch (e) {
    console.error("Failed to send ACK email:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, image_url, schedule_start, schedule_end, screen_id, title, metadata, sender_email } = body;

    if (!image_url) {
      return new Response(JSON.stringify({ error: "image_url est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let status: string = "pending";
    if (action === "schedule" && schedule_start && schedule_end) {
      status = "scheduled";
    } else if (action === "activate") {
      status = "active";
    }

    const insertData: Record<string, unknown> = {
      image_url,
      status,
      title: title || `Contenu reçu ${new Date().toLocaleString("fr-FR")}`,
      source: sender_email ? "email" : "webhook",
      metadata: metadata || null,
      sender_email: sender_email || null,
    };

    if (schedule_start) insertData.start_time = schedule_start;
    if (schedule_end) insertData.end_time = schedule_end;
    if (screen_id) insertData.screen_id = screen_id;

    const { data, error } = await supabase.from("contents").insert(insertData).select().single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Content created: ${data.id} (status: ${status})`);

    // Send acknowledgment email
    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    await sendAckEmail(supabase, data, baseUrl);

    return new Response(JSON.stringify({ success: true, content: data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("content-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
