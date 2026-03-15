import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeBase64(str: string): Uint8Array {
  const cleaned = str.replace(/\r?\n/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseHeader(raw: string, name: string): string {
  const re = new RegExp(`^${name}:\\s*(.+?)(?=\\r?\\n[^\\s]|$)`, "ims");
  const m = raw.match(re);
  return m ? m[1].replace(/\r?\n\s+/g, " ").trim() : "";
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

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const partHeader = part.substring(0, headerEnd);
    const partBody = part.substring(headerEnd + 4);

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

    if ((isAttachment || isImage) && !contentType.startsWith("text/")) {
      let filename = "";
      const fnMatch = (contentDisposition + " " + partHeader).match(/filename="?([^";\r\n]+)"?/i);
      if (fnMatch) filename = fnMatch[1].trim();
      if (!filename && isImage) {
        const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
        filename = `image_${Date.now()}.${ext}`;
      }

      if (filename) {
        let data: Uint8Array;
        if (transferEncoding.includes("base64")) {
          data = decodeBase64(partBody);
        } else {
          data = new TextEncoder().encode(partBody);
        }
        attachments.push({ filename, contentType: contentType.split(";")[0], data });
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

    if (!imapHost || !imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: "IMAP non configuré" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect to IMAP
    let conn: Deno.Conn;
    try {
      if (imapPort === 993) {
        conn = await Deno.connectTls({ hostname: imapHost, port: imapPort });
      } else {
        const tcp = await Deno.connect({ hostname: imapHost, port: imapPort });
        conn = tcp;
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: `Connexion IMAP échouée: ${e.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(65536);
      const n = await conn.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };

    const readFull = async (tag: string): Promise<string> => {
      let response = "";
      let attempts = 0;
      while (attempts < 50) {
        const chunk = await read();
        response += chunk;
        if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) break;
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

    // Login
    const loginResp = await cmd(`LOGIN "${imapUser}" "${imapPass}"`);
    if (!loginResp.includes("OK")) {
      conn.close();
      return new Response(JSON.stringify({ error: "Échec de connexion IMAP" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const emails: any[] = [];
    let imported = 0;

    for (const uid of uids) {
      try {
        // Fetch full email
        const fetchResp = await cmd(`FETCH ${uid} (BODY[] BODY[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)])`);

        const headerSection = fetchResp;
        const from = parseHeader(headerSection, "From");
        const subject = parseHeader(headerSection, "Subject");
        const { name: fromName, email: fromEmail } = extractFromAddress(from);
        const rawDate = extractDateFromHeader(headerSection);
        const messageId = parseHeader(headerSection, "Message-ID");

        // Check if already imported
        if (messageId) {
          const { data: existing } = await supabase
            .from("inbox_emails")
            .select("id")
            .eq("message_id", messageId)
            .limit(1);
          if (existing && existing.length > 0) continue;
        }

        // Parse MIME for attachments
        const boundaryMatch = fetchResp.match(/boundary="?([^";\s\r\n]+)"?/i);
        let bodyText = "";
        const attachments: Attachment[] = [];

        if (boundaryMatch) {
          const parsed = parseMimeParts(fetchResp, boundaryMatch[1]);
          bodyText = parsed.text;
          attachments.push(...parsed.attachments);
        } else {
          // Simple email without MIME parts
          const bodyStart = fetchResp.indexOf("\r\n\r\n");
          if (bodyStart !== -1) bodyText = fetchResp.substring(bodyStart + 4, fetchResp.lastIndexOf(")")).trim();
        }

        // Upload image attachments to storage
        const attachmentUrls: string[] = [];
        for (const att of attachments) {
          if (att.contentType.startsWith("image/")) {
            const filePath = `inbox/${Date.now()}_${att.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("media")
              .upload(filePath, att.data, { contentType: att.contentType, upsert: true });

            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(filePath);
              if (urlData?.publicUrl) attachmentUrls.push(urlData.publicUrl);
            } else {
              console.error("Upload error:", uploadError);
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

        // Auto-create content for image attachments
        let contentId: string | null = null;
        if (attachmentUrls.length > 0) {
          const { data: contentData } = await supabase.from("contents").insert({
            image_url: attachmentUrls[0],
            title: subject || `Email de ${fromName || fromEmail}`,
            status: "pending",
            source: "email",
            sender_email: fromEmail,
          }).select().single();

          if (contentData) {
            contentId = contentData.id;
            await supabase.from("inbox_emails").update({ is_processed: true, content_id: contentId } as any).eq("id", emailRecord?.id);
            imported++;

            // Log action
            await supabase.from("email_actions").insert({
              content_id: contentId,
              action_type: "réception",
              actor_email: fromEmail,
              details: `Contenu importé depuis email "${subject || "(Sans objet)"}" avec ${attachmentUrls.length} pièce(s) jointe(s)`,
            });

            // Send ACK email
            try {
              const baseUrl = Deno.env.get("SUPABASE_URL")!;
              await sendAckEmail(supabase, contentData, baseUrl);
            } catch (ackErr) {
              console.error("ACK email error:", ackErr);
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
        });

        // Mark as seen
        await cmd(`STORE ${uid} +FLAGS (\\Seen)`);
      } catch (e) {
        console.error(`Error processing email ${uid}:`, e);
      }
    }

    await cmd("LOGOUT");
    conn.close();

    return new Response(JSON.stringify({
      message: `${emails.length} email(s) récupéré(s), ${imported} contenu(s) importé(s)`,
      emails,
      imported,
      total: emails.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-inbox error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
