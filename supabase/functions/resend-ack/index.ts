import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content_id } = await req.json();
    if (!content_id) {
      return new Response(JSON.stringify({ error: "content_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: content, error } = await supabase.from("contents").select("*").eq("id", content_id).single();
    if (error || !content) {
      return new Response(JSON.stringify({ error: "Contenu introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!content.sender_email) {
      return new Response(JSON.stringify({ error: "Pas d'email expéditeur associé à ce contenu" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load SMTP config
    const { data: settings } = await supabase.from("app_settings").select("key, value").like("key", "email_%");
    const cfg: Record<string, string> = {};
    (settings || []).forEach((r: any) => { cfg[r.key] = r.value || ""; });

    const smtpHost = cfg.email_smtp_host;
    const smtpPort = parseInt(cfg.email_smtp_port || "587");
    const smtpUser = cfg.email_smtp_user;
    const smtpPass = cfg.email_smtp_password;
    const fromName = cfg.email_from_name || "Affichage Dynamique";
    const fromEmail = cfg.email_from_email || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "SMTP non configuré" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = content.confirmation_token;
    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const validateUrl = `${baseUrl}/functions/v1/content-action?token=${token}&action=validate`;
    const cancelUrl = `${baseUrl}/functions/v1/content-action?token=${token}&action=cancel`;

    const subject = `[Accusé de réception] Contenu "${content.title}" — Réf: ${content.id.slice(0, 8).toUpperCase()}`;
    const textBody = `Accusé de réception — "${content.title || "Sans titre"}"\n\nPour valider: ${validateUrl}\nPour annuler: ${cancelUrl}\n\nOu répondez avec "valider" ou "annuler".`;
    const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f7;padding:20px;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:20px;">📩 Accusé de réception (renvoi)</h1><p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">Votre contenu a été reçu</p></div><div style="padding:30px;"><h2 style="font-size:16px;margin:0 0 15px;">${content.title || "Sans titre"}</h2><p style="font-size:14px;color:#475569;">Réf: ${content.id.slice(0, 8).toUpperCase()} | Statut: ${content.status}</p>${content.image_url ? `<img src="${content.image_url}" style="max-width:100%;max-height:200px;border-radius:8px;margin:15px 0;" />` : ""}<div style="text-align:center;margin:25px 0;"><a href="${validateUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:0 8px;">✅ Valider</a><a href="${cancelUrl}" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:0 8px;">❌ Annuler</a></div><p style="font-size:12px;color:#94a3b8;text-align:center;">Ou répondez à cet email avec "valider" ou "annuler".</p></div></div></body></html>`;

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
    await write(`RCPT TO:<${content.sender_email}>`);
    await write("DATA");

    const boundary = `b_${Date.now()}`;
    const msg = [`From: "${fromName}" <${fromEmail}>`, `To: ${content.sender_email}`, `Subject: ${subject}`, `References: <content-${content.id}@signage>`, `Message-ID: <ack-resend-${content.id}-${Date.now()}@signage>`, `MIME-Version: 1.0`, `Content-Type: multipart/alternative; boundary="${boundary}"`, ``, `--${boundary}`, `Content-Type: text/plain; charset=utf-8`, ``, textBody, ``, `--${boundary}`, `Content-Type: text/html; charset=utf-8`, ``, htmlBody, ``, `--${boundary}--`, `.`].join("\r\n");
    await write(msg);
    await write("QUIT");
    finalConn.close();

    // Log action
    await supabase.from("email_actions").insert({
      content_id: content.id,
      action_type: "renvoi_accusé",
      actor_email: content.sender_email,
      details: `Accusé de réception renvoyé à ${content.sender_email} pour "${content.title || "Sans titre"}"`,
    });

    console.log(`ACK resent to ${content.sender_email}`);
    return new Response(JSON.stringify({ success: true, message: `Accusé renvoyé à ${content.sender_email}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resend-ack error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});