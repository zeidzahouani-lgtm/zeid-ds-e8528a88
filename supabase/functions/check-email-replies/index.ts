import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(JSON.stringify({ error: "IMAP not configured" }), {
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
      return new Response(JSON.stringify({ error: `IMAP connection failed: ${e.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(8192);
      const n = await conn.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };

    let tagCounter = 0;
    const cmd = async (command: string): Promise<string> => {
      const tag = `A${++tagCounter}`;
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
    await read();

    // Login — OAuth2 or basic
    let loginResp: string;
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
        conn.close();
        return new Response(JSON.stringify({ error: `OAuth2 token failed: ${tokenData.error_description || tokenData.error}` }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const xoauth2 = btoa(`user=${imapUser}\x01auth=Bearer ${tokenData.access_token}\x01\x01`);
      loginResp = await cmd(`AUTHENTICATE XOAUTH2 ${xoauth2}`);
    } else {
      loginResp = await cmd(`LOGIN "${imapUser}" "${imapPass}"`);
    }

    if (!loginResp.includes("OK")) {
      conn.close();
      return new Response(JSON.stringify({ error: "IMAP login failed", details: loginResp.slice(0, 200) }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("✅ IMAP login successful");

    // Select INBOX
    await cmd("SELECT INBOX");

    // Search for recent unseen emails
    const searchResp = await cmd("SEARCH UNSEEN");
    const uidMatch = searchResp.match(/\* SEARCH ([\d\s]+)/);
    
    if (!uidMatch) {
      await cmd("LOGOUT");
      conn.close();
      return new Response(JSON.stringify({ message: "No unread emails found", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uids = uidMatch[1].trim().split(/\s+/).slice(-20);
    let processed = 0;
    const results: any[] = [];
    const skipped: string[] = [];

    for (const uid of uids) {
      try {
        // Fetch email headers and body
        const fetchResp = await cmd(`FETCH ${uid} (BODY[HEADER.FIELDS (FROM SUBJECT IN-REPLY-TO REFERENCES)] BODY[TEXT])`);
        
        console.log(`📧 Processing UID ${uid}, response length: ${fetchResp.length}`);

        // Extract From email
        const fromMatch = fetchResp.match(/From:\s*(?:.*<)?([^\s<>]+@[^\s<>]+)>?/i);
        const fromEmail = fromMatch ? fromMatch[1] : null;

        // Extract Subject
        const subjectMatch = fetchResp.match(/Subject:\s*(.+?)(?:\r?\n(?!\s)|\r?\n\r?\n)/is);
        const subject = subjectMatch ? subjectMatch[1].replace(/\r?\n\s+/g, ' ').trim() : "";

        console.log(`  From: ${fromEmail}, Subject: ${subject}`);

        // Method 1: Check References/In-Reply-To headers for our Message-ID pattern
        const refMatch = fetchResp.match(/(?:ack|content)-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})@signage/i);
        
        // Method 2: Check Subject for our reference pattern (Re: [Accusé...] Réf: XXXXXXXX)
        const subjectRefMatch = subject.match(/R[ée]f[.:]\s*([A-F0-9]{8})/i);

        let contentId: string | null = null;

        if (refMatch) {
          contentId = refMatch[1];
          console.log(`  Found content ID via References header: ${contentId}`);
        } else if (subjectRefMatch) {
          // Search by ID prefix from subject
          const prefix = subjectRefMatch[1].toLowerCase();
          console.log(`  Found Ref in subject: ${prefix}, searching...`);
          const { data: matchedContents } = await supabase
            .from("contents")
            .select("id")
            .ilike("id", `${prefix}%`)
            .limit(1);
          if (matchedContents?.length) {
            contentId = matchedContents[0].id;
            console.log(`  Resolved content ID: ${contentId}`);
          }
        }

        if (!contentId) {
          skipped.push(`UID ${uid}: no content reference found`);
          continue;
        }

        // Determine action from body text (case-insensitive)
        const bodyLower = fetchResp.toLowerCase();
        let action: "validate" | "cancel" | null = null;

        if (bodyLower.includes("valider") || bodyLower.includes("approuver") || bodyLower.includes("accepter") || bodyLower.includes("oui")) {
          action = "validate";
        } else if (bodyLower.includes("annuler") || bodyLower.includes("rejeter") || bodyLower.includes("refuser") || bodyLower.includes("non")) {
          action = "cancel";
        }

        console.log(`  Detected action: ${action}`);

        if (!action) {
          skipped.push(`UID ${uid}: no action keyword found in body`);
          continue;
        }

        // Find content
        const { data: contents } = await supabase
          .from("contents")
          .select("id, status, title")
          .eq("id", contentId)
          .limit(1);

        // Fallback: search by prefix if exact match fails
        let content = contents?.[0];
        if (!content) {
          const { data: prefixContents } = await supabase
            .from("contents")
            .select("id, status, title")
            .ilike("id", `${contentId}%`)
            .limit(1);
          content = prefixContents?.[0];
        }

        if (!content) {
          skipped.push(`UID ${uid}: content ${contentId} not found in DB`);
          continue;
        }

        const newStatus = action === "validate" ? "active" : "rejected";

        if (content.status !== newStatus) {
          const { error: updateError } = await supabase.from("contents").update({ status: newStatus }).eq("id", content.id);
          
          if (updateError) {
            console.error(`  Failed to update content ${content.id}:`, updateError);
            continue;
          }

          // Log the action
          await supabase.from("email_actions").insert({
            content_id: content.id,
            action_type: action === "validate" ? "validation" : "annulation",
            actor_email: fromEmail || null,
            details: `Action "${action}" via réponse email pour "${content.title || "Sans titre"}"`,
          });

          results.push({
            content_id: content.id,
            title: content.title,
            action,
            new_status: newStatus,
          });
          processed++;
          console.log(`  ✅ Content "${content.title}" updated to ${newStatus}`);
        } else {
          console.log(`  Content already has status ${newStatus}, skipping`);
        }

        // Mark as seen
        await cmd(`STORE ${uid} +FLAGS (\\Seen)`);
      } catch (e) {
        console.error(`Error processing email ${uid}:`, e);
      }
    }

    await cmd("LOGOUT");
    conn.close();

    console.log(`📊 Processed: ${processed}, Skipped: ${skipped.length}`);
    if (skipped.length > 0) console.log(`Skipped details: ${skipped.join("; ")}`);

    return new Response(JSON.stringify({ 
      message: `Processed ${processed} email replies`, 
      processed, 
      results,
      skipped,
      total_checked: uids.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-email-replies error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
