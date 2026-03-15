import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { model } = await req.json();
    if (!model || typeof model !== "string") {
      return new Response(JSON.stringify({ error: "Veuillez fournir un modèle d'écran." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Clé API IA non configurée." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const playerUrl = Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovable.app") || "https://votre-domaine.com";

    const systemPrompt = `Tu es un expert en affichage dynamique et signalétique numérique. L'utilisateur te donne un modèle d'écran professionnel ou grand public. Tu dois fournir un guide de configuration détaillé et pas-à-pas pour afficher une URL web (player d'affichage dynamique) sur cet écran.

Réponds TOUJOURS en français. Structure ta réponse en Markdown avec :
1. **Identification** : Confirme le modèle, le fabricant, le système d'exploitation intégré (Tizen, webOS, Android, etc.)
2. **Prérequis** : Ce qu'il faut avant de commencer (câbles, réseau, télécommande, etc.)
3. **Étapes de configuration** : Guide numéroté et détaillé pour :
   - Accéder au menu de configuration
   - Configurer le réseau (Wi-Fi/Ethernet)
   - Configurer le lancement automatique d'une URL (URL Launcher, navigateur kiosk, etc.)
   - Configurer le démarrage automatique
   - Sécuriser l'écran (mode kiosk, verrouillage télécommande, etc.)
4. **Astuces** : Conseils spécifiques à ce modèle (codes d'accès admin, raccourcis, etc.)
5. **Dépannage** : Problèmes courants et solutions

Si tu ne connais pas le modèle exact, donne le guide le plus proche basé sur le fabricant et la gamme. Si le modèle n'est pas un écran, indique-le poliment et suggère des alternatives.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Donne-moi le guide de configuration complet pour l'écran : ${model}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques minutes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Service IA temporairement indisponible." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("screen-setup-guide error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
