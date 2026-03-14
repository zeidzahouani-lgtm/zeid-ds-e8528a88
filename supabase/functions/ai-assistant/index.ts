import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
    console.error(`AI gateway ${response.status}:`, text);
    throw { status: 503, message: "Le service IA est temporairement indisponible. Veuillez réessayer dans quelques minutes." };
  }

  return await response.json();
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw { status: 500, message: "LOVABLE_API_KEY is not configured" };

    const { action, prompt, imageUrl } = await req.json();

    // ── Generate Image ──
    if (action === "generate_image") {
      const data = await callAI(LOVABLE_API_KEY, {
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: `Generate a high-quality, professional image for digital signage display: ${prompt}` }],
        modalities: ["image", "text"],
      });
      const msg = data.choices?.[0]?.message;
      return jsonResponse({ image: msg?.images?.[0]?.image_url?.url, text: msg?.content || "" });
    }

    // ── Enhance Image ──
    if (action === "enhance_image") {
      if (!imageUrl) throw { status: 400, message: "imageUrl requis" };
      const data = await callAI(LOVABLE_API_KEY, {
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt || "Enhance this image: improve quality, colors, sharpness. Keep same subject and composition." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        modalities: ["image", "text"],
      });
      const msg = data.choices?.[0]?.message;
      return jsonResponse({ image: msg?.images?.[0]?.image_url?.url, text: msg?.content || "" });
    }

    // ── Suggestions ──
    if (action === "suggest") {
      const data = await callAI(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu es un expert en affichage dynamique (digital signage). Réponds en français. Sois concis et pratique." },
          { role: "user", content: prompt },
        ],
      });

      const content = data.choices?.[0]?.message?.content || "";
      
      // Parse the text response into structured suggestions
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

      // If parsing didn't work, return as summary
      if (suggestions.length === 0) {
        return jsonResponse({ suggestions: [], summary: content });
      }

      return jsonResponse({ suggestions: suggestions.slice(0, 6), summary: "" });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    console.error("ai-assistant error:", e);
    const status = e?.status || 500;
    const message = e?.message || (e instanceof Error ? e.message : "Erreur inconnue");
    return jsonResponse({ error: message }, status);
  }
});
