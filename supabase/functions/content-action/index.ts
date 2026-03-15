import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action");

    if (!token || !action) {
      return new Response(generateHtml("Erreur", "Paramètres manquants (token et action requis).", "error"), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!["validate", "cancel"].includes(action)) {
      return new Response(generateHtml("Erreur", "Action invalide. Utilisez 'validate' ou 'cancel'.", "error"), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find content by token
    const { data: content, error: findError } = await supabase
      .from("contents")
      .select("*")
      .eq("confirmation_token", token)
      .single();

    if (findError || !content) {
      return new Response(generateHtml("Contenu introuvable", "Ce lien est invalide ou le contenu a déjà été supprimé.", "error"), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Check if already processed
    if (content.status === "active" && action === "validate") {
      return new Response(generateHtml("Déjà validé", `Le contenu "${content.title || "Sans titre"}" est déjà actif et en cours de diffusion.`, "info"), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (content.status === "rejected" && action === "cancel") {
      return new Response(generateHtml("Déjà annulé", `Le contenu "${content.title || "Sans titre"}" a déjà été rejeté.`, "info"), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const newStatus = action === "validate" ? "active" : "rejected";
    const { error: updateError } = await supabase
      .from("contents")
      .update({ status: newStatus })
      .eq("id", content.id);

    if (updateError) {
      return new Response(generateHtml("Erreur", `Impossible de mettre à jour le contenu: ${updateError.message}`, "error"), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Log the action
    await supabase.from("email_actions").insert({
      content_id: content.id,
      action_type: action === "validate" ? "validation" : "annulation",
      actor_email: content.sender_email || null,
      details: `Action "${action}" via lien email pour "${content.title || "Sans titre"}"`,
    });

    if (action === "validate") {
      return new Response(generateHtml(
        "✅ Contenu validé !",
        `Le contenu "${content.title || "Sans titre"}" a été approuvé et sera diffusé${content.start_time ? " selon le créneau programmé" : " immédiatement"}.`,
        "success",
        content
      ), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    } else {
      return new Response(generateHtml(
        "❌ Contenu annulé",
        `Le contenu "${content.title || "Sans titre"}" a été rejeté et ne sera pas diffusé.`,
        "cancelled",
        content
      ), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }
  } catch (e) {
    return new Response(generateHtml("Erreur", e instanceof Error ? e.message : "Erreur inconnue", "error"), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
});

function generateHtml(title: string, message: string, type: "success" | "cancelled" | "error" | "info", content?: any): string {
  const colors: Record<string, { bg: string; accent: string; icon: string }> = {
    success: { bg: "#f0fdf4", accent: "#22c55e", icon: "✅" },
    cancelled: { bg: "#fef2f2", accent: "#ef4444", icon: "❌" },
    error: { bg: "#fef2f2", accent: "#ef4444", icon: "⚠️" },
    info: { bg: "#eff6ff", accent: "#3b82f6", icon: "ℹ️" },
  };
  const c = colors[type];

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:${c.bg};min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:500px;background:#fff;border-radius:16px;padding:40px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="font-size:48px;margin-bottom:16px;">${c.icon}</div>
    <h1 style="color:#1e293b;font-size:24px;margin:0 0 12px;">${title}</h1>
    <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 20px;">${message}</p>
    ${content?.image_url ? `<img src="${content.image_url}" style="max-width:100%;max-height:200px;border-radius:8px;margin:16px 0;border:1px solid #e2e8f0;" />` : ""}
    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;">Vous pouvez fermer cette page.</p>
  </div>
</body>
</html>`;
}
