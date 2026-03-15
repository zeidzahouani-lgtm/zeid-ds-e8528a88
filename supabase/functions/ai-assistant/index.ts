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
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase.from("app_settings").select("key, value").in("key", ["openai_api_key", "gemini_api_key", "ai_provider"]);
  const settings: Record<string, string> = {};
  (data || []).forEach((r: any) => { if (r.value) settings[r.key] = r.value; });
  const selectedProvider = settings.ai_provider || "auto";

  if ((selectedProvider === "openai" || selectedProvider === "auto") && settings.openai_api_key) {
    return { name: "openai", baseUrl: "https://api.openai.com/v1/chat/completions", apiKey: settings.openai_api_key, defaultModel: "gpt-4o", imageModel: "gpt-4o", supportsModalities: false };
  }
  if ((selectedProvider === "gemini" || selectedProvider === "auto") && settings.gemini_api_key) {
    return { name: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: settings.gemini_api_key, defaultModel: "gemini-2.5-flash", imageModel: "gemini-2.0-flash-exp-image-generation", supportsModalities: true };
  }
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw { status: 500, message: "Aucune clé API IA configurée." };
  return { name: "lovable", baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: lovableKey, defaultModel: "google/gemini-2.5-flash", imageModel: "google/gemini-3.1-flash-image-preview", supportsModalities: true };
}

function getImageProvider(): AIProvider {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw { status: 500, message: "Clé API pour génération d'images manquante." };
  return { name: "lovable", baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: lovableKey, defaultModel: "google/gemini-2.5-flash", imageModel: "google/gemini-3.1-flash-image-preview", supportsModalities: true };
}

async function callAI(provider: AIProvider, body: Record<string, unknown>) {
  const response = await fetch(provider.baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 429) { await response.text(); throw { status: 429, message: "Limite de requêtes atteinte, réessayez dans quelques minutes." }; }
  if (response.status === 402) { await response.text(); throw { status: 402, message: "Crédits IA insuffisants." }; }
  if (!response.ok) { const text = await response.text(); console.error(`AI ${provider.name} ${response.status}:`, text); throw { status: 503, message: `Service IA (${provider.name}) temporairement indisponible.` }; }
  return await response.json();
}

async function logRequest(authHeader: string | null, action: string, model: string, tokensUsed: number) {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader || "" } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("ai_requests").insert({ user_id: user.id, action, model, tokens_used: tokensUsed });
  } catch (e) { console.error("Failed to log AI request:", e); }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const suggestTools = [{
  type: "function",
  function: {
    name: "create_suggestions",
    description: "Return actionable digital signage suggestions with ready-to-create layouts and playlists.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Brief summary in French" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["layout", "playlist", "tip"] },
              title: { type: "string" },
              description: { type: "string" },
              layout: {
                type: "object",
                properties: {
                  width: { type: "number" }, height: { type: "number" },
                  background_color: { type: "string" },
                  regions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" }, x: { type: "number" }, y: { type: "number" },
                        width: { type: "number" }, height: { type: "number" }, z_index: { type: "number" },
                        widget_type: { type: "string", enum: ["clock", "weather", "marquee", "iframe", "none"] },
                        widget_config: { type: "object" },
                        generate_image_prompt: { type: "string" },
                        is_placeholder: { type: "boolean" }
                      },
                      required: ["name", "x", "y", "width", "height"]
                    }
                  }
                },
                required: ["width", "height", "regions"]
              },
              playlist: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" }, duration: { type: "number" },
                        generate_image_prompt: { type: "string" },
                        is_placeholder: { type: "boolean" }
                      },
                      required: ["name", "duration"]
                    }
                  }
                },
                required: ["items"]
              }
            },
            required: ["type", "title", "description"]
          }
        }
      },
      required: ["summary", "items"]
    }
  }
}];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const reqBody = await req.json();
    const { action, prompt, imageUrl, layout, title, playlist, screenId, establishmentId } = reqBody;

    // ── Stats (no AI provider needed) ──
    if (action === "stats" || action === "daily_stats") {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader || "" } } });

      if (action === "stats") {
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
        return jsonResponse({ today: dayRes.count || 0, this_month: monthRes.count || 0, total: totalRes.count || 0, provider: providerName });
      }

      if (action === "daily_stats") {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: rows } = await supabase.from("ai_requests").select("created_at").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: true });
        const dayCounts: Record<string, number> = {};
        for (let i = 29; i >= 0; i--) { const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000); dayCounts[d.toISOString().slice(0, 10)] = 0; }
        (rows || []).forEach((r: any) => { const day = r.created_at.slice(0, 10); if (day in dayCounts) dayCounts[day]++; });
        return jsonResponse({ daily: Object.entries(dayCounts).map(([date, count]) => ({ date, count })) });
      }
    }

    const provider = await getProvider();

    // ── Test ──
    if (action === "test") {
      const data = await callAI(provider, { model: provider.defaultModel, messages: [{ role: "user", content: "Réponds uniquement 'OK' si tu fonctionnes." }], max_tokens: 10 });
      return jsonResponse({ success: true, response: data.choices?.[0]?.message?.content?.trim() || "", provider: provider.name, model: provider.defaultModel });
    }

    // ── Generate Image (always Lovable gateway) ──
    if (action === "generate_image") {
      const imgProvider = getImageProvider();
      const data = await callAI(imgProvider, { model: imgProvider.imageModel, messages: [{ role: "user", content: `Generate a high-quality, professional image for digital signage display: ${prompt}` }], modalities: ["image", "text"] });
      const msg = data.choices?.[0]?.message;
      await logRequest(authHeader, "generate_image", imgProvider.imageModel, data.usage?.total_tokens || 0);
      return jsonResponse({ image: msg?.images?.[0]?.image_url?.url || null, text: msg?.content || "", provider: provider.name });
    }

    // ── Enhance Image (always Lovable gateway) ──
    if (action === "enhance_image") {
      if (!imageUrl) throw { status: 400, message: "imageUrl requis" };
      const imgProvider = getImageProvider();
      const data = await callAI(imgProvider, {
        model: imgProvider.imageModel,
        messages: [{ role: "user", content: [{ type: "text", text: prompt || "Enhance this image: improve quality, colors, sharpness." }, { type: "image_url", image_url: { url: imageUrl } }] }],
        modalities: ["image", "text"],
      });
      const msg = data.choices?.[0]?.message;
      await logRequest(authHeader, "enhance_image", imgProvider.imageModel, data.usage?.total_tokens || 0);
      return jsonResponse({ image: msg?.images?.[0]?.image_url?.url || null, text: msg?.content || "", provider: provider.name });
    }

    // ── Suggest (structured tool calling) ──
    if (action === "suggest") {
      const data = await callAI(provider, {
        model: provider.defaultModel,
        messages: [
          { role: "system", content: `Tu es un expert en affichage dynamique (digital signage). Propose des layouts et playlists concrets et prêts à être créés.
Pour les layouts : utilise 1920x1080, place des régions avec des widgets (clock, weather, marquee) et des zones médias. Mets des generate_image_prompt pour les zones où tu veux générer une image IA et is_placeholder=true pour les zones où l'utilisateur mettra son propre contenu.
Pour les playlists : propose 4-8 éléments avec des durées variées, des generate_image_prompt pour les images à générer et is_placeholder=true pour les contenus personnels.
Réponds en français. Propose 2-4 suggestions concrètes et variées.` },
          { role: "user", content: prompt },
        ],
        tools: suggestTools,
        tool_choice: { type: "function", function: { name: "create_suggestions" } },
      });

      const msg = data.choices?.[0]?.message;
      await logRequest(authHeader, "suggest", provider.defaultModel, data.usage?.total_tokens || 0);

      let result: any = { summary: "", items: [] };
      if (msg?.tool_calls?.[0]?.function?.arguments) {
        try { result = JSON.parse(msg.tool_calls[0].function.arguments); } catch { result = { summary: msg?.content || "", items: [] }; }
      } else if (msg?.content) {
        result = { summary: msg.content, items: [] };
      }
      return jsonResponse({ ...result, provider: provider.name });
    }

    // ── Create Layout from AI suggestion ──
    if (action === "create_layout") {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader || "" } } });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { status: 401, message: "Non authentifié" };

      const layoutSpec = reqBody.layout;
      const layoutTitle = reqBody.title || "Layout IA";

      const layoutInsert: Record<string, any> = {
        name: layoutTitle, user_id: user.id,
        width: layoutSpec.width || 1920, height: layoutSpec.height || 1080,
        background_color: layoutSpec.background_color || "#1a1a2e",
      };
      if (establishmentId) layoutInsert.establishment_id = establishmentId;

      const { data: newLayout, error: layoutErr } = await supabase.from("layouts").insert(layoutInsert).select().single();
      if (layoutErr) throw { status: 500, message: layoutErr.message };

      const regions = layoutSpec.regions || [];
      const regionInserts = [];

      for (const region of regions) {
        let mediaId = null;

        if (region.generate_image_prompt) {
          try {
            const imgProvider = getImageProvider();
            const imgData = await callAI(imgProvider, {
              model: imgProvider.imageModel,
              messages: [{ role: "user", content: `Generate a professional image for digital signage: ${region.generate_image_prompt}` }],
              modalities: ["image", "text"],
            });
            const imgUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (imgUrl) {
              const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, "");
              const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const fileName = `ai-layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
              await supabase.storage.from("media").upload(fileName, binaryData, { contentType: "image/png" });
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);

              const mediaInsert: Record<string, any> = {
                name: region.name || "Image IA", type: "image", url: urlData.publicUrl, duration: 10, user_id: user.id,
              };
              if (establishmentId) mediaInsert.establishment_id = establishmentId;

              const { data: mediaRow } = await supabase.from("media").insert(mediaInsert).select().single();
              if (mediaRow) mediaId = mediaRow.id;
              await logRequest(authHeader, "generate_image", imgProvider.imageModel, imgData.usage?.total_tokens || 0);
            }
          } catch (e) { console.error("Image generation failed for region:", region.name, e); }
        }

        regionInserts.push({
          layout_id: newLayout.id, name: region.name || "Zone",
          x: region.x || 0, y: region.y || 0, width: region.width || 300, height: region.height || 200,
          z_index: region.z_index || 0,
          widget_type: region.widget_type && region.widget_type !== "none" ? region.widget_type : null,
          widget_config: region.widget_config || null,
          media_id: mediaId,
        });
      }

      if (regionInserts.length > 0) {
        const { error: regErr } = await supabase.from("layout_regions").insert(regionInserts);
        if (regErr) console.error("Region insert error:", regErr);
      }

      return jsonResponse({ success: true, layout_id: newLayout.id, message: `Layout "${layoutTitle}" créé avec ${regionInserts.length} zones` });
    }

    // ── Create Playlist from AI suggestion ──
    if (action === "create_playlist") {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader || "" } } });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { status: 401, message: "Non authentifié" };

      const playlistSpec = reqBody.playlist;
      const playlistTitle = reqBody.title || "Playlist IA";
      const targetScreenId = reqBody.screenId;

      if (!targetScreenId) throw { status: 400, message: "screenId requis pour créer une playlist" };

      const playlistItems = playlistSpec?.items || [];
      let position = 0;

      for (const item of playlistItems) {
        let mediaId = null;

        if (item.generate_image_prompt && !item.is_placeholder) {
          try {
            const imgProvider = getImageProvider();
            const imgData = await callAI(imgProvider, {
              model: imgProvider.imageModel,
              messages: [{ role: "user", content: `Generate a professional image for digital signage: ${item.generate_image_prompt}` }],
              modalities: ["image", "text"],
            });
            const imgUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (imgUrl) {
              const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, "");
              const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const fileName = `ai-playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
              await supabase.storage.from("media").upload(fileName, binaryData, { contentType: "image/png" });
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);

              const mediaInsert: Record<string, any> = {
                name: item.name || "Image IA", type: "image", url: urlData.publicUrl, duration: item.duration || 10, user_id: user.id,
              };
              if (establishmentId) mediaInsert.establishment_id = establishmentId;

              const { data: mediaRow } = await supabase.from("media").insert(mediaInsert).select().single();
              if (mediaRow) mediaId = mediaRow.id;
              await logRequest(authHeader, "generate_image", imgProvider.imageModel, imgData.usage?.total_tokens || 0);
            }
          } catch (e) { console.error("Image generation failed for playlist item:", item.name, e); }
        }

        if (mediaId) {
          await supabase.from("playlist_items").insert({ screen_id: targetScreenId, media_id: mediaId, position });
          position++;
        }
      }

      return jsonResponse({ success: true, items_created: position, message: `Playlist "${playlistTitle}" créée avec ${position} éléments` });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    console.error("ai-assistant error:", e);
    return jsonResponse({ error: e?.message || "Erreur inconnue" }, e?.status || 500);
  }
});
