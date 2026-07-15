
-- =========================================================
-- 1. SCREENS: scope + column-level GRANTs for anon
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read screens for player" ON public.screens;
DROP POLICY IF EXISTS "Anon can update player runtime fields" ON public.screens;

REVOKE ALL ON public.screens FROM anon;
GRANT SELECT (
  id, name, orientation, status, current_media_id, layout_id, playlist_id,
  program_id, show_name, debug_mode, resolution, wall_id, wall_row, wall_col,
  player_session_id, player_heartbeat_at, pending_action, establishment_id,
  slug, fallback_since, fallback_notified
) ON public.screens TO anon;
GRANT UPDATE (
  status, current_media_id, player_session_id, player_heartbeat_at,
  player_ip, player_lan_ip, player_user_agent, ip_address, os_type,
  pending_action, fallback_since, fallback_notified
) ON public.screens TO anon;

CREATE POLICY "Anon read player-facing screens"
  ON public.screens
  FOR SELECT
  TO anon
  USING (slug IS NOT NULL);

CREATE POLICY "Anon update player runtime for self screen"
  ON public.screens
  FOR UPDATE
  TO anon
  USING (slug IS NOT NULL)
  WITH CHECK (slug IS NOT NULL);

-- =========================================================
-- 2. ESTABLISHMENTS: scope + column-level GRANTs for anon
-- =========================================================
DROP POLICY IF EXISTS "Anon can read establishments for player" ON public.establishments;

REVOKE ALL ON public.establishments FROM anon;
GRANT SELECT (id, logo_url, updated_at) ON public.establishments TO anon;

CREATE POLICY "Anon read establishments referenced by a screen"
  ON public.establishments
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.establishment_id = establishments.id
        AND s.slug IS NOT NULL
    )
  );

-- =========================================================
-- 3. MEDIA: scope + column-level GRANTs for anon
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read media for player" ON public.media;

REVOKE ALL ON public.media FROM anon;
GRANT SELECT (id, name, type, url, duration) ON public.media TO anon;

CREATE POLICY "Anon read media referenced by player content"
  ON public.media
  FOR SELECT
  TO anon
  USING (
    EXISTS (SELECT 1 FROM public.screens s WHERE s.current_media_id = media.id)
    OR EXISTS (
      SELECT 1 FROM public.playlist_items pi
      WHERE pi.media_id = media.id
        AND (
          pi.screen_id IS NOT NULL
          OR pi.playlist_id IN (SELECT playlist_id FROM public.screens WHERE playlist_id IS NOT NULL)
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.schedules sc
      WHERE sc.media_id = media.id
    )
  );

-- =========================================================
-- 4. PLAYLIST_ITEMS: drop redundant unscoped anon policy
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read playlist_items for player" ON public.playlist_items;

-- =========================================================
-- 5. PLAYLISTS: not needed by the player, drop anon SELECT
-- =========================================================
DROP POLICY IF EXISTS "Anon read playlists" ON public.playlists;
REVOKE SELECT ON public.playlists FROM anon;

-- =========================================================
-- 6. PROGRAMS: not needed by the player, drop anon SELECT
-- =========================================================
DROP POLICY IF EXISTS "Anon read programs" ON public.programs;
REVOKE SELECT ON public.programs FROM anon;

-- =========================================================
-- 7. VIDEO_WALLS: scope + column-level GRANTs for anon
-- =========================================================
DROP POLICY IF EXISTS "Anon read video_walls for player" ON public.video_walls;

REVOKE ALL ON public.video_walls FROM anon;
GRANT SELECT (id, rows, cols) ON public.video_walls TO anon;

CREATE POLICY "Anon read video_walls referenced by a screen"
  ON public.video_walls
  FOR SELECT
  TO anon
  USING (
    EXISTS (SELECT 1 FROM public.screens s WHERE s.wall_id = video_walls.id)
  );

-- =========================================================
-- 8. STORAGE uploads: tighten anon insert to active fallback windows only
-- =========================================================
DROP POLICY IF EXISTS "Uploads must target existing screen prefix" ON storage.objects;

CREATE POLICY "Anon uploads only while screen QR fallback is active"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND name ~ '^screen-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    AND EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id::text = substring(storage.objects.name, '^screen-([0-9a-f-]{36})/')
        AND (
          -- Authenticated members can always upload
          (auth.uid() IS NOT NULL AND s.establishment_id IS NOT NULL
             AND public.is_member_of(auth.uid(), s.establishment_id))
          -- Anonymous uploads (QR code flow) require the screen to be
          -- actively displaying its fallback QR right now
          OR (s.fallback_since IS NOT NULL
              AND s.fallback_since > now() - interval '1 hour')
        )
    )
  );

-- =========================================================
-- 9. SECURITY DEFINER: revoke EXECUTE from anon/authenticated
--    on internal-only helpers and trigger/cron functions
-- =========================================================
-- RLS helper functions — should never be called via the API
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.establishment_role(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_establishment(uuid, uuid) FROM anon, authenticated, PUBLIC;

-- Trigger-only functions
REVOKE EXECUTE ON FUNCTION public.screens_anon_update_guard() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_screen_offline() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_screen_slug() FROM anon, authenticated, PUBLIC;

-- Cron/admin-only maintenance functions
REVOKE EXECUTE ON FUNCTION public.check_fallback_alerts() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_old_readiness_history() FROM anon, authenticated, PUBLIC;

-- player_health_snapshot: only admins (authenticated) use it via the UI;
-- anon reaches it only through the /player-health edge function which uses
-- the service role, so anon has no legitimate need
REVOKE EXECUTE ON FUNCTION public.player_health_snapshot() FROM anon, PUBLIC;
