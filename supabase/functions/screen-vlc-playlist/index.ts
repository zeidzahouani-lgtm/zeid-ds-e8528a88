// Public M3U playlist generator for VLC (and any M3U-compatible player).
// Returns a text/plain .m3u listing all media URLs scheduled for a screen:
//   - Active AutoFlow contents (status='active', within start/end window)
//   - Media items from the screen's assigned playlist
//   - Media items from schedules attached to the screen's program
//   - Media items from schedules attached directly to the screen
//
// Usage:  GET /functions/v1/screen-vlc-playlist?screen=<slug-or-uuid>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function m3uLine(durationSec: number, title: string, url: string) {
  const safeTitle = (title || "media").replace(/[\r\n,]/g, " ").trim();
  return `#EXTINF:${Math.max(1, Math.round(durationSec))},${safeTitle}\n${url}\n`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const ident = (url.searchParams.get("screen") || "").trim();
    if (!ident) {
      return new Response("Missing 'screen' query param", { status: 400, headers: corsHeaders });
    }

    // Resolve screen by uuid or slug
    const isUuid = UUID_RE.test(ident);
    const { data: screen, error: screenErr } = await supabase
      .from("screens")
      .select("id, name, playlist_id, program_id")
      .eq(isUuid ? "id" : "slug", ident)
      .maybeSingle();

    if (screenErr) throw screenErr;
    if (!screen) {
      return new Response("Screen not found", { status: 404, headers: corsHeaders });
    }

    const lines: string[] = ["#EXTM3U", `#PLAYLIST:${screen.name || "ScreenFlow"}`];
    const seen = new Set<string>();
    const push = (durationSec: number, title: string, mediaUrl: string) => {
      if (!mediaUrl || seen.has(mediaUrl)) return;
      seen.add(mediaUrl);
      lines.push(m3uLine(durationSec, title, mediaUrl).trimEnd());
    };

    // 1) Active AutoFlow contents
    const nowIso = new Date().toISOString();
    const { data: contents } = await supabase
      .from("contents")
      .select("title, image_url, start_time, end_time, status")
      .eq("screen_id", screen.id)
      .eq("status", "active");
    for (const c of contents ?? []) {
      if (c.start_time && c.start_time > nowIso) continue;
      if (c.end_time && c.end_time < nowIso) continue;
      push(15, c.title || "Contenu", c.image_url);
    }

    // 2) Items of the screen's assigned playlist
    if (screen.playlist_id) {
      const { data: items } = await supabase
        .from("playlist_items")
        .select("duration, position, media:media_id(name, url, duration)")
        .eq("playlist_id", screen.playlist_id)
        .order("position", { ascending: true });
      for (const it of items ?? []) {
        const m: any = it.media;
        if (!m?.url) continue;
        push(it.duration ?? m.duration ?? 10, m.name, m.url);
      }
    }

    // 3) Schedules linked to the screen's program OR directly to the screen
    const orFilter = screen.program_id
      ? `screen_id.eq.${screen.id},program_id.eq.${screen.program_id}`
      : `screen_id.eq.${screen.id}`;
    const { data: schedules } = await supabase
      .from("schedules")
      .select("media_id, playlist_id, active")
      .or(orFilter);

    const mediaIds = new Set<string>();
    const playlistIds = new Set<string>();
    for (const s of schedules ?? []) {
      if (s.active === false) continue;
      if (s.media_id) mediaIds.add(s.media_id);
      if (s.playlist_id) playlistIds.add(s.playlist_id);
    }

    if (mediaIds.size) {
      const { data: meds } = await supabase
        .from("media")
        .select("name, url, duration")
        .in("id", [...mediaIds]);
      for (const m of meds ?? []) push(m.duration ?? 10, m.name, m.url);
    }

    if (playlistIds.size) {
      const { data: items } = await supabase
        .from("playlist_items")
        .select("duration, position, media:media_id(name, url, duration)")
        .in("playlist_id", [...playlistIds])
        .order("position", { ascending: true });
      for (const it of items ?? []) {
        const m: any = it.media;
        if (!m?.url) continue;
        push(it.duration ?? m.duration ?? 10, m.name, m.url);
      }
    }

    if (lines.length <= 2) {
      lines.push(m3uLine(10, "Aucun contenu programmé", "about:blank").trimEnd());
    }

    const body = lines.join("\n") + "\n";
    const filename = `${(screen.name || "screen").replace(/[^a-z0-9-_]+/gi, "_")}.m3u`;

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/x-mpegurl; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[screen-vlc-playlist] error", e);
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
