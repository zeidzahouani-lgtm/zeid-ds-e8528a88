import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendAckEmail(supabase: any, content: any, baseUrl: string) {
  const { data: settings } = await supabase.from("app_settings").select("key, value").like("key", "email_%");
  const cfg: Record<string, string> = {};
  (settings || []).forEach((r: any) => { cfg[r.key] = r.value || ""; });

  const smtpHost = cfg.email_smtp_host;
  const smtpPort = parseInt(cfg.email_smtp_port || "587");
  const smtpUser = cfg.email_smtp_user;
  const smtpPass = cfg.email_smtp_password;
  const fromName = cfg.email_from_name || "Affichage Dynamique";
  const fromEmail = cfg.email_from_email || smtpUser;
  const authMethod = cfg.email_auth_method || "basic";
  const oauthTenantId = cfg.email_oauth_tenant_id;
  const oauthClientId = cfg.email_oauth_client_id;
  const oauthClientSecret = cfg.email_oauth_client_secret;

  if (!smtpHost || !smtpUser || !content.sender_email) {
    console.log("SMTP not configured or no sender_email, skipping ACK");
    return;
  }

  const token = content.confirmation_token;
  const validateUrl = `${baseUrl}/functions/v1/content-action?token=${token}&action=validate`;
  const cancelUrl = `${baseUrl}/functions/v1/content-action?token=${token}&action=cancel`;

  // Find screen name if assigned
  let screenLabel = "Tous les écrans";
  if (content.screen_id) {
    const { data: screenData } = await supabase.from("screens").select("name").eq("id", content.screen_id).single();
    if (screenData) screenLabel = screenData.name;
  }

  const statusLabel = content.status === "scheduled" ? "Programmé" : content.status === "active" ? "Activé immédiatement" : "En attente de validation";
  const startStr = content.start_time ? new Date(content.start_time).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "Non défini";
  const endStr = content.end_time ? new Date(content.end_time).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "Non défini";
  const createdStr = new Date(content.created_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const refCode = content.id.slice(0, 8).toUpperCase();

  const subject = `[Accusé de réception] Contenu "${content.title || "Sans titre"}" — Réf: ${refCode}`;

  const textBody = `Accusé de réception — Contenu "${content.title || "Sans titre"}"

Référence: ${refCode}
Statut: ${statusLabel}
Écran cible: ${screenLabel}
Source: email
Reçu le: ${createdStr}
Début de diffusion: ${startStr}
Fin de diffusion: ${endStr}

Actions prévues:
- Le contenu sera soumis à validation manuelle avant diffusion
- L'image sera optimisée pour l'affichage sur écran
${content.screen_id ? `- Le contenu sera affiché sur l'écran "${screenLabel}"` : "- Le contenu pourra être assigné à un écran depuis le tableau de bord"}
${content.start_time && content.end_time ? "- La diffusion sera activée/désactivée selon le créneau défini" : "- Aucun créneau horaire — diffusion en continu une fois validé"}

Pour valider: ${validateUrl}
Pour annuler: ${cancelUrl}

Ou répondez à cet email avec "valider" ou "annuler".`;

  const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
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
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Référence</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace;">${refCode}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Statut</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${statusLabel}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Écran cible</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${screenLabel}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Début de diffusion</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${startStr}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Fin de diffusion</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${endStr}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Source</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">Email</td></tr>
        <tr><td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Reçu le</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">${createdStr}</td></tr>
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
        ${content.screen_id ? `<li>Le contenu sera affiché sur l'écran <strong>"${screenLabel}"</strong></li>` : "<li>Le contenu pourra être assigné à un écran spécifique depuis le tableau de bord</li>"}
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
</body></html>`;

  try {
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
    const write = async (cmd: string) => {
      await finalConn.write(new TextEncoder().encode(cmd + "\r\n"));
      const resp = await read();
      console.log(`SMTP << ${resp.trim().substring(0, 100)}`);
      return resp;
    };

    // Read greeting (for 465 and plain)
    if (smtpPort !== 587) {
      const greeting = await read();
      console.log(`SMTP greeting: ${greeting.trim().substring(0, 100)}`);
    }

    const ehloResp = await write("EHLO localhost");
    
    // AUTH — OAuth2 or basic
    let authResp: string;
    if (authMethod === "oauth2" && oauthTenantId && oauthClientId && oauthClientSecret) {
      const tokenUrl = `https://login.microsoftonline.com/${oauthTenantId}/oauth2/v2.0/token`;
      const tokenBody = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: oauthClientId,
        client_secret: oauthClientSecret,
        scope: "https://outlook.office365.com/.default",
      });
      const tokenResp = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok || !tokenData.access_token) {
        console.error("OAuth2 token failed for SMTP:", tokenData.error_description || tokenData.error);
        finalConn.close();
        return;
      }
      const xoauth2 = btoa(`user=${smtpUser}\x01auth=Bearer ${tokenData.access_token}\x01\x01`);
      authResp = await write(`AUTH XOAUTH2 ${xoauth2}`);
    } else {
      authResp = await write(`AUTH PLAIN ${btoa(`\0${smtpUser}\0${smtpPass}`)}`);
    }

    const mailResp = await write(`MAIL FROM:<${fromEmail}>`);
    if (!mailResp.includes("250")) {
      console.error("SMTP MAIL FROM failed:", mailResp.trim());
      finalConn.close();
      return;
    }

    const rcptResp = await write(`RCPT TO:<${content.sender_email}>`);
    if (!rcptResp.includes("250")) {
      console.error("SMTP RCPT TO failed:", rcptResp.trim());
      finalConn.close();
      return;
    }

    const dataResp = await write("DATA");
    if (!dataResp.includes("354")) {
      console.error("SMTP DATA failed:", dataResp.trim());
      finalConn.close();
      return;
    }

    const boundary = `b_${Date.now()}`;
    const msg = [
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
      `Content-Transfer-Encoding: 8bit`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
      `.`
    ].join("\r\n");

    const sendResp = await write(msg);
    console.log(`SMTP send response: ${sendResp.trim().substring(0, 100)}`);
    
    await write("QUIT");
    finalConn.close();
    
    if (sendResp.includes("250")) {
      console.log(`✅ ACK email successfully sent to ${content.sender_email}`);
    } else {
      console.error(`⚠️ ACK email may not have been sent. Response: ${sendResp.trim()}`);
    }
  } catch (e) {
    console.error("❌ Failed to send ACK email:", e);
  }
}

function decodeBase64(str: string): Uint8Array {
  // Clean: remove whitespace, newlines, and any non-base64 chars at the end
  let cleaned = str.replace(/[\r\n\s]/g, "");
  
  // Remove any trailing non-base64 characters (IMAP protocol data)
  cleaned = cleaned.replace(/[^A-Za-z0-9+/=]+$/, "");
  
  // Ensure proper padding
  const remainder = cleaned.length % 4;
  if (remainder === 2) cleaned += "==";
  else if (remainder === 3) cleaned += "=";
  else if (remainder === 1) cleaned = cleaned.slice(0, -1); // invalid, trim last char
  
  try {
    const binary = atob(cleaned);
    const CHUNK_SIZE = 8192;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, binary.length);
      for (let j = i; j < end; j++) {
        bytes[j] = binary.charCodeAt(j);
      }
    }
    return bytes;
  } catch (e) {
    console.error("Base64 decode error, input length:", cleaned.length, e);
    return new Uint8Array(0);
  }
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeMimeEncodedWords(str: string): string {
  // Decode =?charset?encoding?encoded_text?= patterns
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        const bytes = decodeBase64(text);
        return new TextDecoder(charset).decode(bytes);
      } else if (encoding.toUpperCase() === "Q") {
        const decoded = text
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return decoded;
      }
    } catch (e) {
      console.error("MIME decode error:", e);
    }
    return text;
  });
}

function parseHeader(raw: string, name: string): string {
  const re = new RegExp(`^${name}:\\s*(.+?)(?=\\r?\\n[^\\s]|$)`, "ims");
  const m = raw.match(re);
  if (!m) return "";
  const raw_value = m[1].replace(/\r?\n\s+/g, " ").trim();
  return decodeMimeEncodedWords(raw_value);
}

function extractFromAddress(from: string): { name: string; email: string } {
  const m = from.match(/^"?(.+?)"?\s*<(.+?)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: "", email: from.trim() };
}

function extractDateFromHeader(raw: string): string | null {
  const dateStr = parseHeader(raw, "Date");
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

interface Attachment {
  filename: string;
  contentType: string;
  data: Uint8Array;
}

function parseMimeParts(body: string, boundary: string): { text: string; attachments: Attachment[] } {
  const parts = body.split(`--${boundary}`);
  let text = "";
  const attachments: Attachment[] = [];

  for (const part of parts) {
    if (part.trim() === "--" || part.trim() === "") continue;

    // Try both \r\n\r\n and \n\n for header separator
    let headerEnd = part.indexOf("\r\n\r\n");
    let headerSepLen = 4;
    if (headerEnd === -1) {
      headerEnd = part.indexOf("\n\n");
      headerSepLen = 2;
    }
    if (headerEnd === -1) continue;

    const partHeader = part.substring(0, headerEnd);
    const partBody = part.substring(headerEnd + headerSepLen);

    const contentType = parseHeader(partHeader, "Content-Type").toLowerCase();
    const contentDisposition = parseHeader(partHeader, "Content-Disposition").toLowerCase();
    const transferEncoding = parseHeader(partHeader, "Content-Transfer-Encoding").toLowerCase();

    // Check for nested multipart
    const nestedBoundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
    if (nestedBoundaryMatch) {
      const nested = parseMimeParts(partBody, nestedBoundaryMatch[1]);
      if (nested.text && !text) text = nested.text;
      attachments.push(...nested.attachments);
      continue;
    }

    const isAttachment = contentDisposition.includes("attachment") || contentDisposition.includes("inline");
    const isImage = contentType.startsWith("image/");
    const isVideo = contentType.startsWith("video/");
    const isPdf = contentType.includes("pdf");

    if ((isAttachment || isImage || isVideo || isPdf) && !contentType.startsWith("text/")) {
      let filename = "";
      // Try Content-Disposition filename first, then Content-Type name
      const fnMatch = (contentDisposition + " " + partHeader).match(/filename="?([^";\r\n]+)"?/i);
      if (fnMatch) filename = fnMatch[1].trim();
      
      // Also check name= in Content-Type
      if (!filename) {
        const nameMatch = contentType.match(/name="?([^";\r\n]+)"?/i);
        if (nameMatch) filename = nameMatch[1].trim();
      }
      
      if (!filename && isImage) {
        const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
        filename = `image_${Date.now()}.${ext}`;
      }
      if (!filename && isVideo) {
        const ext = contentType.split("/")[1]?.split(";")[0] || "mp4";
        filename = `video_${Date.now()}.${ext}`;
      }

      if (filename) {
        let data: Uint8Array;
        if (transferEncoding.includes("base64")) {
          // Clean partBody: remove anything after the base64 content
          // Base64 content ends before the next boundary or closing paren
          let cleanBody = partBody;
          // Remove trailing IMAP artifacts like ")\r\nA5 OK..."
          const closingParenIdx = cleanBody.lastIndexOf("\n)");
          if (closingParenIdx !== -1) {
            cleanBody = cleanBody.substring(0, closingParenIdx);
          }
          data = decodeBase64(cleanBody);
        } else {
          data = new TextEncoder().encode(partBody);
        }
        
        if (data.length > 0) {
          console.log(`📎 Attachment found: ${filename} (${contentType.split(";")[0]}, ${data.length} bytes)`);
          attachments.push({ filename, contentType: contentType.split(";")[0], data });
        } else {
          console.warn(`⚠️ Empty attachment: ${filename}`);
        }
      }
    } else if (contentType.startsWith("text/plain") && !text) {
      if (transferEncoding.includes("base64")) {
        text = new TextDecoder().decode(decodeBase64(partBody));
      } else if (transferEncoding.includes("quoted-printable")) {
        text = decodeQuotedPrintable(partBody);
      } else {
        text = partBody;
      }
    }
  }

  return { text, attachments };
}

function extractRfc822FromFetchResponse(fetchResp: string): string {
  const literalMatch = fetchResp.match(/BODY\[\]\s+\{(\d+)\}\r?\n/i);
  if (!literalMatch || literalMatch.index === undefined) return fetchResp;

  const literalSize = parseInt(literalMatch[1], 10);
  if (!Number.isFinite(literalSize) || literalSize <= 0) return fetchResp;

  const start = literalMatch.index + literalMatch[0].length;
  const rawEmail = fetchResp.slice(start, start + literalSize);
  return rawEmail || fetchResp;
}

/**
 * Parse screen name from text. Supported formats:
 * [ecran:nom], [écran:nom], [screen:nom], ecran: nom, écran=nom, screen:nom
 */
function parseScreenFromText(input: string): string | null {
  if (!input) return null;

  const text = input.replace(/\r?\n/g, " ").trim();
  const patterns = [
    /\[(?:ecran|écran|screen)\s*[:=]\s*([^\]\r\n]+)\]/i,
    /(?:^|\s)(?:ecran|écran|screen)\s*[:=]\s*([^,;\r\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/^['"\s]+|['"\s]+$/g, "");
    }
  }

  return null;
}

/**
 * Parse schedule/duration directives from email text. Supported formats:
 * [durée:30min], [duree:2h], [durée:1h30], [debut:2025-03-20 14:00], [fin:2025-03-20 18:00], [statut:actif]
 */
function parseScheduleFromText(input: string): {
  start_time?: string;
  end_time?: string;
  status?: string;
} {
  if (!input) return {};
  const text = input.replace(/\r?\n/g, " ").trim();
  const result: { start_time?: string; end_time?: string; status?: string } = {};

  // Parse duration: [durée:30min], [duree:2h], [durée:1h30]
  const durationMatch = text.match(/\[(?:dur[eéè]+e?)\s*[:=]\s*(\d+)\s*(min|h|heure|heures?)(?:(\d+)\s*(?:min)?)?\]/i);
  if (durationMatch) {
    const now = new Date();
    result.start_time = now.toISOString();
    let totalMinutes = 0;
    if (durationMatch[2].startsWith("h")) {
      totalMinutes = parseInt(durationMatch[1]) * 60;
      if (durationMatch[3]) totalMinutes += parseInt(durationMatch[3]);
    } else {
      totalMinutes = parseInt(durationMatch[1]);
    }
    result.end_time = new Date(now.getTime() + totalMinutes * 60000).toISOString();
    result.status = "active";
  }

  // Parse explicit start: [debut:2025-03-20 14:00] or [début:...]
  const startMatch = text.match(/\[(?:d[eéè]but|start)\s*[:=]\s*([^\]]+)\]/i);
  if (startMatch) {
    const d = new Date(startMatch[1].trim());
    if (!isNaN(d.getTime())) result.start_time = d.toISOString();
  }

  // Parse explicit end: [fin:2025-03-20 18:00] or [end:...]
  const endMatch = text.match(/\[(?:fin|end)\s*[:=]\s*([^\]]+)\]/i);
  if (endMatch) {
    const d = new Date(endMatch[1].trim());
    if (!isNaN(d.getTime())) result.end_time = d.toISOString();
  }

  // Parse status: [statut:actif]
  const statusMatch = text.match(/\[(?:statut|status)\s*[:=]\s*(actif|active|programm[eéè]+|scheduled|pending|en attente)\]/i);
  if (statusMatch) {
    const s = statusMatch[1].toLowerCase();
    if (s === "actif" || s === "active") result.status = "active";
    else if (s.startsWith("programm") || s === "scheduled") result.status = "scheduled";
    else result.status = "pending";
  }

  return result;
}

async function resolveScreenId(supabase: any, screenName: string): Promise<string | null> {
  const normalizedName = screenName.toLowerCase().trim();
  
  // Try exact match first
  const { data: exact } = await supabase
    .from("screens")
    .select("id, name")
    .ilike("name", normalizedName)
    .limit(1);
  
  if (exact && exact.length > 0) return exact[0].id;
  
  // Try slug match
  const { data: bySlug } = await supabase
    .from("screens")
    .select("id, name")
    .ilike("slug", normalizedName.replace(/\s+/g, "-"))
    .limit(1);
  
  if (bySlug && bySlug.length > 0) return bySlug[0].id;
  
  // Try partial match
  const { data: partial } = await supabase
    .from("screens")
    .select("id, name")
    .ilike("name", `%${normalizedName}%`)
    .limit(1);
  
  if (partial && partial.length > 0) return partial[0].id;
  
  console.warn(`⚠️ Screen not found for name: "${screenName}"`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load IMAP config
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .like("key", "email_%");

    const cfg: Record<string, string> = {};
    (settings || []).forEach((r: any) => { cfg[r.key] = r.value || ""; });

    const imapHost = cfg.email_imap_host;
    const imapPort = parseInt(cfg.email_imap_port || "993");
    const imapUser = cfg.email_imap_user;
    const imapPass = cfg.email_imap_password;
    const authMethod = cfg.email_auth_method || "basic";
    const oauthTenantId = cfg.email_oauth_tenant_id;
    const oauthClientId = cfg.email_oauth_client_id;
    const oauthClientSecret = cfg.email_oauth_client_secret;

    if (!imapHost || !imapUser) {
      return new Response(JSON.stringify({ error: "IMAP non configuré" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (authMethod === "basic" && !imapPass) {
      return new Response(JSON.stringify({ error: "Mot de passe IMAP non configuré" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (authMethod === "oauth2" && (!oauthTenantId || !oauthClientId || !oauthClientSecret)) {
      return new Response(JSON.stringify({ error: "Configuration OAuth2 incomplète" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📬 Connecting to IMAP ${imapHost}:${imapPort} (auth: ${authMethod})...`);

    // Connect to IMAP
    let conn: Deno.Conn;
    try {
      if (imapPort === 993) {
        conn = await Deno.connectTls({ hostname: imapHost, port: imapPort });
      } else {
        conn = await Deno.connect({ hostname: imapHost, port: imapPort });
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: `Connexion IMAP échouée: ${e.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(131072);
      const n = await conn.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };

    const readFull = async (tag: string): Promise<string> => {
      let response = "";
      let attempts = 0;
      const donePattern = new RegExp(`(?:\\r?\\n|^)${tag}\\s+(OK|NO|BAD)\\b`, "m");

      while (attempts < 150) {
        const chunk = await read();
        if (!chunk) break;

        response += chunk;
        if (donePattern.test(response)) break;

        attempts++;
      }

      return response;
    };

    let tagCounter = 0;
    const cmd = async (command: string): Promise<string> => {
      const tag = `A${++tagCounter}`;
      await conn.write(new TextEncoder().encode(`${tag} ${command}\r\n`));
      return await readFull(tag);
    };

    // Read greeting
    await read();

    // Login — OAuth2 or basic
    let loginResp: string;
    if (authMethod === "oauth2") {
      const tokenUrl = `https://login.microsoftonline.com/${oauthTenantId}/oauth2/v2.0/token`;
      const tokenBody = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: oauthClientId,
        client_secret: oauthClientSecret,
        scope: "https://outlook.office365.com/.default",
      });
      const tokenResp = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok || !tokenData.access_token) {
        conn.close();
        return new Response(JSON.stringify({ error: `Échec OAuth2: ${tokenData.error_description || tokenData.error || "Token request failed"}` }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const xoauth2 = btoa(`user=${imapUser}\x01auth=Bearer ${tokenData.access_token}\x01\x01`);
      loginResp = await cmd(`AUTHENTICATE XOAUTH2 ${xoauth2}`);
    } else {
      loginResp = await cmd(`LOGIN "${imapUser}" "${imapPass}"`);
    }

    if (!loginResp.includes("OK")) {
      conn.close();
      return new Response(JSON.stringify({ error: "Échec de connexion IMAP", details: loginResp.trim().slice(0, 200) }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("✅ IMAP login successful");

    // Select INBOX
    await cmd("SELECT INBOX");

    // Search for unseen emails
    const searchResp = await cmd("SEARCH UNSEEN");
    const uidMatch = searchResp.match(/\* SEARCH ([\d\s]+)/);

    if (!uidMatch) {
      await cmd("LOGOUT");
      conn.close();
      return new Response(JSON.stringify({ message: "Aucun email non lu", emails: [], imported: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uids = uidMatch[1].trim().split(/\s+/).slice(-15);
    console.log(`📧 Found ${uids.length} unseen email(s)`);
    const emails: any[] = [];
    let imported = 0;

    for (const uid of uids) {
      try {
        // Fetch raw RFC822 message
        const fetchResp = await cmd(`FETCH ${uid} (BODY[])`);
        const rawEmail = extractRfc822FromFetchResponse(fetchResp);

        const headerSection = rawEmail;
        const from = parseHeader(headerSection, "From");
        const subject = parseHeader(headerSection, "Subject");
        const { name: fromName, email: fromEmail } = extractFromAddress(from);
        const rawDate = extractDateFromHeader(headerSection);
        const messageId = parseHeader(headerSection, "Message-ID");

        console.log(`📩 Processing email from ${fromEmail}: "${subject}"`);

        // Check if already imported
        if (messageId) {
          const { data: existing } = await supabase
            .from("inbox_emails")
            .select("id")
            .eq("message_id", messageId)
            .limit(1);
          if (existing && existing.length > 0) {
            console.log(`⏭️ Skipping already imported email: ${messageId}`);
            continue;
          }
        }

        let screenId: string | null = null;

        // Parse MIME for attachments
        const boundaryMatch = rawEmail.match(/boundary="?([^";\s\r\n]+)"?/i);
        let bodyText = "";
        const attachments: Attachment[] = [];

        if (boundaryMatch) {
          const parsed = parseMimeParts(rawEmail, boundaryMatch[1]);
          bodyText = parsed.text;
          attachments.push(...parsed.attachments);
        } else {
          // Simple email without MIME parts
          const bodyStart = rawEmail.indexOf("\r\n\r\n");
          if (bodyStart !== -1) bodyText = rawEmail.substring(bodyStart + 4).trim();
        }

        console.log(`📎 Found ${attachments.length} attachment(s) in email from ${fromEmail}`);

        // Parse screen from subject first, then fallback to email body
        const requestedScreenName = parseScreenFromText(subject || "") || parseScreenFromText(bodyText || "");
        if (requestedScreenName) {
          screenId = await resolveScreenId(supabase, requestedScreenName);
          console.log(`🖥️ Screen requested: "${requestedScreenName}" → ${screenId || "NOT FOUND"}`);
        } else {
          console.log("🖥️ No screen directive detected in subject/body");
        }

        // Upload attachments to storage
        const attachmentUrls: string[] = [];
        for (const att of attachments) {
          if (att.contentType.startsWith("image/") || att.contentType.startsWith("video/")) {
            const sanitizedName = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
            const filePath = `inbox/${Date.now()}_${sanitizedName}`;
            
            console.log(`⬆️ Uploading ${att.filename} (${att.data.length} bytes) to ${filePath}...`);
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("media")
              .upload(filePath, att.data, { contentType: att.contentType, upsert: true });

            if (uploadError) {
              console.error(`❌ Upload failed for ${att.filename}:`, uploadError);
              
              // Retry with uploads bucket
              const { data: retryData, error: retryError } = await supabase.storage
                .from("uploads")
                .upload(filePath, att.data, { contentType: att.contentType, upsert: true });
              
              if (retryError) {
                console.error(`❌ Retry upload also failed:`, retryError);
              } else if (retryData) {
                const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
                if (urlData?.publicUrl) {
                  attachmentUrls.push(urlData.publicUrl);
                  console.log(`✅ Uploaded to uploads bucket: ${urlData.publicUrl}`);
                }
              }
            } else if (uploadData) {
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(filePath);
              if (urlData?.publicUrl) {
                attachmentUrls.push(urlData.publicUrl);
                console.log(`✅ Uploaded: ${urlData.publicUrl}`);
              }
            }
          }
        }

        // Save email to database
        const { data: emailRecord } = await supabase.from("inbox_emails").insert({
          message_id: messageId || null,
          from_email: fromEmail,
          from_name: fromName || null,
          subject: subject || "(Sans objet)",
          body_preview: bodyText.slice(0, 500).trim() || null,
          has_attachments: attachments.length > 0,
          attachment_count: attachments.length,
          attachment_urls: attachmentUrls,
          raw_date: rawDate,
          is_processed: false,
        } as any).select().single();

        // Auto-create content for image/video attachments
        let contentId: string | null = null;
        if (attachmentUrls.length > 0) {
          // Clean title (remove all tags from subject)
           let cleanTitle = (subject || `Email de ${fromName || fromEmail}`)
             .replace(/\[(?:ecran|écran|screen|dur[eéè]+e?|d[eéè]but|start|fin|end|statut|status)\s*[:=][^\]]+\]/gi, "")
             .replace(/(?:^|\s)(?:ecran|écran|screen)\s*[:=]\s*[^,;\r\n]+/gi, "")
             .trim();
          if (!cleanTitle) cleanTitle = `Email de ${fromName || fromEmail}`;

          // Parse schedule/duration from subject + body
          const scheduleFromSubject = parseScheduleFromText(subject || "");
          const scheduleFromBody = parseScheduleFromText(bodyText || "");
          const schedule = {
            ...scheduleFromBody,
            ...scheduleFromSubject, // subject takes priority
          };

          const insertData: Record<string, unknown> = {
            image_url: attachmentUrls[0],
            title: cleanTitle,
            status: schedule.status || "pending",
            source: "email",
            sender_email: fromEmail,
          };

          if (schedule.start_time) insertData.start_time = schedule.start_time;
          if (schedule.end_time) insertData.end_time = schedule.end_time;

          // Assign screen if found
          if (screenId) {
            insertData.screen_id = screenId;
          }

          console.log(`📅 Schedule parsed: status=${schedule.status || "pending"}, start=${schedule.start_time || "none"}, end=${schedule.end_time || "none"}`);

          const { data: contentData, error: contentError } = await supabase.from("contents").insert(insertData).select().single();

          if (contentError) {
            console.error(`❌ Content creation failed:`, contentError);
          } else if (contentData) {
            contentId = contentData.id;
            console.log(`✅ Content created: ${contentId} (screen: ${screenId || "none"})`);
            
            await supabase.from("inbox_emails").update({ is_processed: true, content_id: contentId } as any).eq("id", emailRecord?.id);
            imported++;

            // Log action
            await supabase.from("email_actions").insert({
              content_id: contentId,
              action_type: "réception",
              actor_email: fromEmail,
              details: `Contenu importé depuis email "${subject || "(Sans objet)"}" avec ${attachmentUrls.length} pièce(s) jointe(s)${screenId ? ` — Écran: ${requestedScreenName}` : ""}`,
            });

            // Send ACK email
            try {
              const baseUrl = Deno.env.get("SUPABASE_URL")!;
              await sendAckEmail(supabase, contentData, baseUrl);
            } catch (ackErr) {
              console.error("❌ ACK email error:", ackErr);
            }
          }
        }

        emails.push({
          id: emailRecord?.id,
          from_email: fromEmail,
          from_name: fromName,
          subject,
          has_attachments: attachments.length > 0,
          attachment_count: attachments.length,
          attachment_urls: attachmentUrls,
          content_id: contentId,
          raw_date: rawDate,
          screen_id: screenId,
        });

        // Mark as seen
        await cmd(`STORE ${uid} +FLAGS (\\Seen)`);
      } catch (e) {
        console.error(`❌ Error processing email ${uid}:`, e);
      }
    }

    await cmd("LOGOUT");
    conn.close();

    console.log(`📊 Summary: ${emails.length} email(s) processed, ${imported} content(s) imported`);

    return new Response(JSON.stringify({
      message: `${emails.length} email(s) récupéré(s), ${imported} contenu(s) importé(s)`,
      emails,
      imported,
      total: emails.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ check-inbox error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
