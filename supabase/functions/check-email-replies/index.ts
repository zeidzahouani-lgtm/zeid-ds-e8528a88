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

    if (!imapHost || !imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: "IMAP not configured" }), {
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
      while (attempts < 20) {
        const chunk = await read();
        response += chunk;
        if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) break;
        attempts++;
      }
      return response;
    };

    // Read greeting
    await read();

    // Login
    const loginResp = await cmd(`LOGIN "${imapUser}" "${imapPass}"`);
    if (!loginResp.includes("OK")) {
      conn.close();
      return new Response(JSON.stringify({ error: "IMAP login failed", details: loginResp.slice(0, 200) }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const uids = uidMatch[1].trim().split(/\s+/).slice(-20); // Last 20 unread
    let processed = 0;
    const results: any[] = [];

    for (const uid of uids) {
      try {
        // Fetch email body
        const fetchResp = await cmd(`FETCH ${uid} (BODY[TEXT] BODY[HEADER.FIELDS (FROM SUBJECT IN-REPLY-TO REFERENCES)])`);
        
        const bodyText = fetchResp.toLowerCase();
        
        // Check if this is a reply to our ACK email
        const isReplyToAck = fetchResp.includes("content-") && fetchResp.includes("@signage");
        
        if (!isReplyToAck) continue;

        // Extract content reference from References/In-Reply-To header
        const refMatch = fetchResp.match(/ack-([a-f0-9-]+)@signage/i) || fetchResp.match(/content-([a-f0-9-]+)@signage/i);
        if (!refMatch) continue;

        const contentId = refMatch[1];

        // Determine action from body
        let action: "validate" | "cancel" | null = null;
        if (bodyText.includes("valider") || bodyText.includes("approuver") || bodyText.includes("accepter") || bodyText.includes("oui")) {
          action = "validate";
        } else if (bodyText.includes("annuler") || bodyText.includes("rejeter") || bodyText.includes("refuser") || bodyText.includes("non")) {
          action = "cancel";
        }

        if (!action) continue;

        // Find content by ID prefix
        const { data: contents } = await supabase
          .from("contents")
          .select("id, status, title")
          .like("id", `${contentId}%`)
          .limit(1);

        if (!contents?.length) continue;

        const content = contents[0];
        const newStatus = action === "validate" ? "active" : "rejected";

        if (content.status !== newStatus) {
          await supabase.from("contents").update({ status: newStatus }).eq("id", content.id);
          
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
        }

        // Mark as seen
        await cmd(`STORE ${uid} +FLAGS (\\Seen)`);
      } catch (e) {
        console.error(`Error processing email ${uid}:`, e);
      }
    }

    await cmd("LOGOUT");
    conn.close();

    return new Response(JSON.stringify({ 
      message: `Processed ${processed} email replies`, 
      processed, 
      results 
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
