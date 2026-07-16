// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Severity = "ok" | "warn" | "error";
interface Finding {
  category: string;
  target: string;
  severity: Severity;
  message: string;
  detail?: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: only global admins may run this
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: adminRow } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) return json({ error: "Forbidden — global admin only" }, 403);

    const findings: Finding[] = [];
    const t0 = Date.now();

    // ---- 1. RLS enabled on every public table ------------------------------
    const { data: rlsRows, error: rlsErr } = await svc.rpc("player_health_snapshot").then(() => ({ data: null, error: null })).catch(() => ({ data: null, error: null }));
    // Use raw SQL via a lightweight query on pg_class through a service call:
    const { data: pgTables, error: pgErr } = await svc
      .from("pg_tables" as any)
      .select("tablename, rowsecurity, schemaname")
      .eq("schemaname", "public");

    if (pgErr) {
      findings.push({ category: "rls", target: "*", severity: "warn", message: "Impossible de lister les tables publiques (lecture pg_tables refusée).", detail: pgErr.message });
    } else if (pgTables) {
      for (const t of pgTables as any[]) {
        if (t.rowsecurity === false) {
          findings.push({
            category: "rls",
            target: `public.${t.tablename}`,
            severity: "error",
            message: `RLS désactivée sur la table ${t.tablename}.`,
          });
        }
      }
      findings.push({ category: "rls", target: "summary", severity: "ok", message: `${(pgTables as any[]).length} tables publiques inspectées.` });
    }

    // ---- 2. Storage buckets availability -----------------------------------
    const expectedBuckets = ["media", "uploads"];
    const { data: buckets, error: bucketsErr } = await svc.storage.listBuckets();
    if (bucketsErr) {
      findings.push({ category: "storage", target: "*", severity: "error", message: "Impossible de lister les buckets.", detail: bucketsErr.message });
    } else {
      const names = new Set((buckets ?? []).map((b: any) => b.name));
      for (const b of expectedBuckets) {
        if (!names.has(b)) {
          findings.push({ category: "storage", target: b, severity: "error", message: `Bucket manquant : ${b}` });
        } else {
          // Try listing at root to confirm accessibility
          const { error: listErr } = await svc.storage.from(b).list("", { limit: 1 });
          if (listErr) {
            findings.push({ category: "storage", target: b, severity: "warn", message: `Bucket ${b} inaccessible (list): ${listErr.message}` });
          } else {
            findings.push({ category: "storage", target: b, severity: "ok", message: `Bucket ${b} accessible.` });
          }
        }
      }
    }

    // ---- 3. Per-screen checks ---------------------------------------------
    const { data: screens, error: sErr } = await svc
      .from("screens")
      .select("id, name, slug, orientation, status, current_media_id, playlist_id, program_id, layout_id, establishment_id, player_heartbeat_at");
    if (sErr) {
      findings.push({ category: "screens", target: "*", severity: "error", message: "Lecture des écrans échouée.", detail: sErr.message });
    } else {
      const now = Date.now();
      for (const s of (screens ?? []) as any[]) {
        const label = `${s.name}${s.slug ? ` (${s.slug})` : ""}`;

        // License
        const { data: lic } = await svc.rpc("validate_license_for_screen", { _screen_id: s.id });
        const licRow = Array.isArray(lic) ? lic[0] : lic;
        if (!licRow || licRow.valid !== true) {
          findings.push({
            category: "screen",
            target: label,
            severity: "error",
            message: `Licence invalide : ${licRow?.message ?? "inconnue"}`,
          });
        }

        // Establishment
        if (!s.establishment_id) {
          findings.push({ category: "screen", target: label, severity: "warn", message: "Écran non rattaché à un établissement." });
        }

        // Heartbeat freshness
        if (!s.player_heartbeat_at) {
          findings.push({ category: "screen", target: label, severity: "warn", message: "Aucun heartbeat reçu (jamais connecté ou hors-ligne)." });
        } else {
          const ageMin = Math.round((now - new Date(s.player_heartbeat_at).getTime()) / 60000);
          if (ageMin > 30) {
            findings.push({ category: "screen", target: label, severity: "warn", message: `Dernier heartbeat il y a ${ageMin} min.` });
          }
        }

        // Content assignment
        const hasContent = s.current_media_id || s.playlist_id || s.program_id || s.layout_id;
        if (!hasContent) {
          findings.push({ category: "screen", target: label, severity: "warn", message: "Aucun contenu assigné (média, playlist, programme ou layout)." });
        }

        // Current media existence
        if (s.current_media_id) {
          const { data: m } = await svc.from("media").select("id, url").eq("id", s.current_media_id).maybeSingle();
          if (!m) {
            findings.push({ category: "screen", target: label, severity: "error", message: `current_media_id référence un média introuvable (${s.current_media_id}).` });
          } else if (!m.url) {
            findings.push({ category: "screen", target: label, severity: "error", message: `Média assigné sans URL.` });
          }
        }

        // Playlist state
        if (s.playlist_id) {
          const { data: pl } = await svc.from("playlists").select("id, name").eq("id", s.playlist_id).maybeSingle();
          if (!pl) {
            findings.push({ category: "playlist", target: label, severity: "error", message: `playlist_id référence une playlist introuvable.` });
          } else {
            const { data: items, error: itErr } = await svc
              .from("playlist_items")
              .select("id, media_id, order_index")
              .eq("playlist_id", pl.id);
            if (itErr) {
              findings.push({ category: "playlist", target: label, severity: "warn", message: `Lecture items playlist échouée : ${itErr.message}` });
            } else if (!items || items.length === 0) {
              findings.push({ category: "playlist", target: label, severity: "error", message: `Playlist « ${pl.name} » assignée mais vide.` });
            } else {
              const missing: string[] = [];
              const mediaIds = items.map((i: any) => i.media_id).filter(Boolean);
              if (mediaIds.length) {
                const { data: mediaRows } = await svc.from("media").select("id, url").in("id", mediaIds);
                const foundIds = new Set((mediaRows ?? []).map((m: any) => m.id));
                for (const it of items) {
                  if (it.media_id && !foundIds.has(it.media_id)) missing.push(it.media_id);
                }
                const withoutUrl = (mediaRows ?? []).filter((m: any) => !m.url).length;
                if (withoutUrl > 0) {
                  findings.push({ category: "playlist", target: label, severity: "warn", message: `${withoutUrl} média(s) de la playlist « ${pl.name} » sans URL.` });
                }
              }
              if (missing.length) {
                findings.push({
                  category: "playlist",
                  target: label,
                  severity: "error",
                  message: `${missing.length} item(s) de la playlist « ${pl.name} » référencent un média inexistant.`,
                  detail: missing.slice(0, 5),
                });
              }
            }
          }
        }
      }
      findings.push({ category: "screens", target: "summary", severity: "ok", message: `${(screens ?? []).length} écran(s) inspecté(s).` });
    }

    // ---- Summary -----------------------------------------------------------
    const counts = { ok: 0, warn: 0, error: 0 };
    for (const f of findings) counts[f.severity]++;
    const status: Severity = counts.error > 0 ? "error" : counts.warn > 0 ? "warn" : "ok";

    return json({
      status,
      counts,
      duration_ms: Date.now() - t0,
      timestamp: new Date().toISOString(),
      findings,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
