import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AIProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  imageModel: string;
  supportsModalities: boolean;
}

async function getProvider(): Promise<AIProvider> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["openai_api_key", "gemini_api_key", "ai_provider"]);

  const settings: Record<string, string> = {};
  (data || []).forEach((r: any) => { if (r.value) settings[r.key] = r.value; });

  const selectedProvider = settings.ai_provider || "auto";

  // OpenAI provider
  if ((selectedProvider === "openai" || selectedProvider === "auto") && settings.openai_api_key) {
    return {
      name: "openai",
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: settings.openai_api_key,
      defaultModel: "gpt-4o",
      imageModel: "gpt-4o",
      supportsModalities: false,
    };
  }

  // Google Gemini provider (OpenAI-compatible endpoint)
  if ((selectedProvider === "gemini" || selectedProvider === "auto") && settings.gemini_api_key) {
    return {
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: settings.gemini_api_key,
      defaultModel: "gemini-2.5-flash",
      imageModel: "gemini-2.0-flash-exp-image-generation",
      supportsModalities: true,
    };
  }

  // Fallback to Lovable AI (always available for image generation)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw { status: 500, message: "Aucune clé API IA configurée. Ajoutez votre clé dans Administration > Personnalisation." };

  return {
    name: "lovable",
    baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: lovableKey,
    defaultModel: "google/gemini-2.5-flash",
    imageModel: "google/gemini-3.1-flash-image-preview",
    supportsModalities: true,
  };
}

// Get provider specifically for image generation (always Lovable gateway)
async function getImageProvider(): Promise<AIProvider> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw { status: 500, message: "Aucune clé API IA configurée pour la génération d'images." };

  return {
    name: "lovable",
    baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: lovableKey,
    defaultModel: "google/gemini-2.5-flash",
    imageModel: "google/gemini-3.1-flash-image-preview",
    supportsModalities: true,
  };
}

async function callAI(provider: AIProvider, body: Record<string, unknown>) {
  const response = await fetch(provider.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    await response.text();
    throw { status: 429, message: "Limite de requêtes atteinte, réessayez dans quelques minutes." };
  }
  if (response.status === 402) {
    await response.text();
    throw { status: 402, message: "Crédits IA insuffisants." };
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`AI ${provider.name} ${response.status}:`, text);
    throw { status: 503, message: `Service IA (${provider.name}) temporairement indisponible. Vérifiez votre clé API.` };
  }

  return await response.json();
}

async function logRequest(authHeader: string | null, action: string, model: string, tokensUsed: number) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("ai_requests").insert({
        user_id: user.id,
        action,
        model,
        tokens_used: tokensUsed,
      });
    }
  } catch (e) {
    console.error("Failed to log AI request:", e);
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const { action, prompt, imageUrl } = await req.json();

    // ── Actions that don't need AI provider ──
    if (action === "stats" || action === "daily_stats") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader || "" } } }
      );

      if (action === "stats") {
        // Also get provider info
        let providerName = "lovable";
        try { const p = await getProvider(); providerName = p.name; } catch {}

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const [monthRes, dayRes, totalRes] = await Promise.all([
          supabase.from("ai_requests").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
          supabase.from("ai_requests").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
          supabase.from("ai_requests").select("id", { count: "exact", head: true }),
        ]);

        return jsonResponse({
          today: dayRes.count || 0,
          this_month: monthRes.count || 0,
          total: totalRes.count || 0,
          provider: providerName,
        });
      }

      if (action === "daily_stats") {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: rows } = await supabase
          .from("ai_requests")
          .select("created_at")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: true });

        const dayCounts: Record<string, number> = {};
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          dayCounts[d.toISOString().slice(0, 10)] = 0;
        }
        (rows || []).forEach((r: any) => {
          const day = r.created_at.slice(0, 10);
          if (day in dayCounts) dayCounts[day]++;
        });

        const daily = Object.entries(dayCounts).map(([date, count]) => ({ date, count }));
        return jsonResponse({ daily });
      }
    }

    // ── Actions that need AI provider ──
    const provider = await getProvider();

    // ── Test API ──
    if (action === "test") {
      const data = await callAI(provider, {
        model: provider.defaultModel,
        messages: [
          { role: "user", content: "Réponds uniquement 'OK' si tu fonctionnes." },
        ],
        max_tokens: 10,
      });
      const content = data.choices?.[0]?.message?.content || "";
      return jsonResponse({ success: true, response: content.trim(), provider: provider.name, model: provider.defaultModel });
    }

    // ── Generate Image (always uses Lovable gateway for reliable image output) ──
    if (action === "generate_image") {
      const imgProvider = await getImageProvider();
      const data = await callAI(imgProvider, {
        model: imgProvider.imageModel,
        messages: [{ role: "user", content: `Generate a high-quality, professional image for digital signage display: ${prompt}` }],
        modalities: ["image", "text"],
      });
      const msg = data.choices?.[0]?.message;
      const tokens = data.usage?.total_tokens || 0;
      await logRequest(authHeader, "generate_image", imgProvider.imageModel, tokens);

      const image = msg?.images?.[0]?.image_url?.url || null;
      return jsonResponse({ image, text: msg?.content || "", provider: provider.name });
    }

    // ── Enhance Image (always uses Lovable gateway) ──
    if (action === "enhance_image") {
      if (!imageUrl) throw { status: 400, message: "imageUrl requis" };
      const imgProvider = await getImageProvider();
      const messages: any[] = [{
        role: "user",
        content: [
          { type: "text", text: prompt || "Enhance this image: improve quality, colors, sharpness. Keep same subject and composition." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }];

      const data = await callAI(imgProvider, {
        model: imgProvider.imageModel,
        messages,
        modalities: ["image", "text"],
      });
      const msg = data.choices?.[0]?.message;
      const tokens = data.usage?.total_tokens || 0;
      await logRequest(authHeader, "enhance_image", imgProvider.imageModel, tokens);

      const image = msg?.images?.[0]?.image_url?.url || null;
      return jsonResponse({ image, text: msg?.content || "", provider: provider.name });
    }

    // ── Suggestions ──
    if (action === "suggest") {
      const data = await callAI(provider, {
        model: provider.defaultModel,
        messages: [
          { role: "system", content: "Tu es un expert en affichage dynamique (digital signage). Réponds en français. Sois concis et pratique." },
          { role: "user", content: prompt },
        ],
      });

      const content = data.choices?.[0]?.message?.content || "";
      const tokens = data.usage?.total_tokens || 0;
      await logRequest(authHeader, "suggest", provider.defaultModel, tokens);

      const lines = content.split("\n").filter((l: string) => l.trim());
      const suggestions: { title: string; description: string; type: string }[] = [];
      let currentTitle = "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("##") || trimmed.startsWith("**")) {
          currentTitle = trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
        } else if (currentTitle && trimmed.length > 10) {
          const type = currentTitle.toLowerCase().includes("playlist") ? "playlist"
            : currentTitle.toLowerCase().includes("layout") ? "layout" : "tip";
          suggestions.push({ title: currentTitle, description: trimmed.replace(/^[-*]\s*/, ""), type });
          currentTitle = "";
        }
      }

      if (suggestions.length === 0) {
        return jsonResponse({ suggestions: [], summary: content, provider: provider.name });
      }
      return jsonResponse({ suggestions: suggestions.slice(0, 6), summary: "", provider: provider.name });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    console.error("ai-assistant error:", e);
    const status = e?.status || 500;
    const message = e?.message || (e instanceof Error ? e.message : "Erreur inconnue");
    return jsonResponse({ error: message }, status);
  }
});
