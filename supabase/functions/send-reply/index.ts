import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to, subject, body, in_reply_to } = await req.json();
    if (!to || !body) {
      return new Response(JSON.stringify({ error: "to et body requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
    const ehloResp = await write("EHLO localhost");
    const supportsDsn = /\bDSN\b/i.test(ehloResp);
    await write(`AUTH PLAIN ${btoa(`\0${smtpUser}\0${smtpPass}`)}`);
    await write(`MAIL FROM:<${fromEmail}>${supportsDsn ? " RET=HDRS" : ""}`);
    const rcptOpts = supportsDsn ? " NOTIFY=SUCCESS,FAILURE,DELAY" : "";
    await write(`RCPT TO:<${to}>${rcptOpts}`);
    // BCC to sender mailbox so user keeps a copy in their inbox
    if (fromEmail && fromEmail.toLowerCase() !== to.toLowerCase()) {
      await write(`RCPT TO:<${fromEmail}>${rcptOpts}`);
    }
    await write("DATA");

    const b64wrap = (s: string) => { const b = btoa(unescape(encodeURIComponent(s))); return b.match(/.{1,76}/g)?.join("\r\n") ?? b; };
    const finalSubject = subject?.startsWith("Re:") ? subject : `Re: ${subject || "(sans objet)"}`;
    const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1e293b;padding:16px;"><div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${body.replace(/[&<>]/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))}</div></body></html>`;

    const headers = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${finalSubject}`,
      `Message-ID: <reply-${Date.now()}@signage>`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      `Disposition-Notification-To: ${fromEmail}`,
      `Return-Receipt-To: ${fromEmail}`,
    ];
    if (in_reply_to) headers.push(`In-Reply-To: ${in_reply_to}`, `References: ${in_reply_to}`);

    const msg = [...headers, ``, b64wrap(htmlBody), `.`].join("\r\n");
    await write(msg);
    await write("QUIT");
    finalConn.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
