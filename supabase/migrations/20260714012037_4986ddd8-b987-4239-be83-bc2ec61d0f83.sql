
-- SCREENS
REVOKE SELECT, UPDATE ON public.screens FROM anon;
GRANT SELECT (
  id, name, orientation, status, current_media_id, slug,
  playlist_id, program_id, layout_id, wall_id, wall_row, wall_col,
  show_name, resolution, os_type, pending_action, establishment_id,
  player_session_id, player_heartbeat_at, updated_at, created_at,
  fallback_since, debug_mode
) ON public.screens TO anon;
GRANT UPDATE (
  status, current_media_id, pending_action,
  player_session_id, player_heartbeat_at, player_user_agent,
  player_ip, player_lan_ip, ip_address, os_type,
  fallback_since, fallback_notified
) ON public.screens TO anon;

CREATE OR REPLACE FUNCTION public.screens_anon_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  EXCEPTION WHEN OTHERS THEN v_role := NULL;
  END;
  IF v_role IS DISTINCT FROM 'anon' THEN RETURN NEW; END IF;
  IF OLD.player_session_id IS NOT NULL
     AND OLD.player_heartbeat_at IS NOT NULL
     AND OLD.player_heartbeat_at > now() - interval '20 seconds'
     AND OLD.player_session_id IS DISTINCT FROM NEW.player_session_id THEN
    RAISE EXCEPTION 'screen is locked by an active player session';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_screens_anon_update_guard ON public.screens;
CREATE TRIGGER trg_screens_anon_update_guard
BEFORE UPDATE ON public.screens
FOR EACH ROW EXECUTE FUNCTION public.screens_anon_update_guard();

-- LICENSES
DROP POLICY IF EXISTS "Anon can claim unassigned license" ON public.licenses;
DROP POLICY IF EXISTS "Anyone can read licenses for player" ON public.licenses;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.licenses FROM anon;

CREATE OR REPLACE FUNCTION public.list_available_licenses_for_screen(_screen_id uuid)
RETURNS TABLE(id uuid, license_key_masked text, valid_until timestamptz, source text, establishment_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_est uuid;
BEGIN
  SELECT s.establishment_id INTO v_est FROM public.screens s WHERE s.id = _screen_id;
  RETURN QUERY
  SELECT l.id,
         ('••••-' || right(l.license_key, 4))::text,
         l.valid_until, l.source, l.establishment_id
  FROM public.licenses l
  WHERE l.screen_id IS NULL AND l.is_active = true AND l.valid_until > now()
    AND (v_est IS NULL OR l.establishment_id IS NULL OR l.establishment_id = v_est)
  ORDER BY l.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_license_for_screen(_license_id uuid, _screen_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_screen_est uuid; v_lic_est uuid; v_updated int;
BEGIN
  SELECT establishment_id INTO v_screen_est FROM public.screens WHERE id = _screen_id;
  SELECT establishment_id INTO v_lic_est FROM public.licenses
    WHERE id = _license_id AND screen_id IS NULL AND is_active = true AND valid_until > now();
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_lic_est IS NOT NULL AND v_screen_est IS NOT NULL AND v_lic_est <> v_screen_est THEN
    RETURN false;
  END IF;
  UPDATE public.licenses
     SET screen_id = _screen_id, activated_at = now()
   WHERE id = _license_id AND screen_id IS NULL AND is_active = true AND valid_until > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END; $$;

REVOKE EXECUTE ON FUNCTION public.list_available_licenses_for_screen(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_license_for_screen(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_available_licenses_for_screen(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_license_for_screen(uuid, uuid) TO anon, authenticated;

-- ESTABLISHMENTS
REVOKE SELECT ON public.establishments FROM anon;
GRANT SELECT (id, name, logo_url, description, max_screens) ON public.establishments TO anon;

-- ESTABLISHMENT_SETTINGS
DROP POLICY IF EXISTS "Anon can read branding settings" ON public.establishment_settings;
CREATE POLICY "Anon can read branding settings"
ON public.establishment_settings FOR SELECT TO anon
USING (key IN ('brand_show_logo_player','brand_player_bg_color','brand_player_watermark','brand_logo_url'));

-- CONTENTS
REVOKE SELECT ON public.contents FROM anon;
GRANT SELECT (id, image_url, status, screen_id, start_time, end_time, metadata, title, source, created_at, updated_at) ON public.contents TO anon;

DROP POLICY IF EXISTS "Anon can insert via webhook" ON public.contents;
CREATE POLICY "Anon can insert via webhook"
ON public.contents FOR INSERT TO anon
WITH CHECK (
  screen_id IS NOT NULL AND image_url IS NOT NULL
  AND status = 'pending'::content_status
  AND sender_email IS NULL AND user_id IS NULL
);

-- LAYOUTS
DROP POLICY IF EXISTS "Anyone can read layouts for player" ON public.layouts;
CREATE POLICY "Anon can read layouts used by screens"
ON public.layouts FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.screens s WHERE s.layout_id = layouts.id AND s.slug IS NOT NULL));

REVOKE SELECT ON public.layouts FROM anon;
GRANT SELECT (
  id, name, width, height, background_color,
  bg_type, bg_image_url, bg_image_fit, bg_overlay_darken, bg_overlay_blur,
  establishment_id, wall_id, wall_mode
) ON public.layouts TO anon;

-- LAYOUT_REGIONS
DROP POLICY IF EXISTS "Anyone can read layout_regions for player" ON public.layout_regions;
DROP POLICY IF EXISTS "Anon can read layout_regions for player" ON public.layout_regions;
CREATE POLICY "Anon can read layout_regions of player layouts"
ON public.layout_regions FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.layouts l
  JOIN public.screens s ON s.layout_id = l.id
  WHERE l.id = layout_regions.layout_id AND s.slug IS NOT NULL
));

-- MEDIA
REVOKE SELECT ON public.media FROM anon;
GRANT SELECT (id, name, type, url, duration, created_at) ON public.media TO anon;

-- PLAYLISTS + PROGRAMS
REVOKE SELECT ON public.playlists FROM anon;
GRANT SELECT (id, name, establishment_id, created_at) ON public.playlists TO anon;

REVOKE SELECT ON public.programs FROM anon;
GRANT SELECT (id, name, establishment_id, created_at) ON public.programs TO anon;

-- SCHEDULES
DROP POLICY IF EXISTS "Anyone can read schedules for player" ON public.schedules;
CREATE POLICY "Anon can read schedules of player screens"
ON public.schedules FOR SELECT TO anon
USING (
  (screen_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.screens s WHERE s.id = schedules.screen_id AND s.slug IS NOT NULL))
  OR (playlist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.screens s WHERE s.playlist_id = schedules.playlist_id AND s.slug IS NOT NULL))
  OR (program_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.screens s WHERE s.program_id = schedules.program_id AND s.slug IS NOT NULL))
);

-- PLAYLIST_ITEMS
DROP POLICY IF EXISTS "Anyone can read playlist items for player" ON public.playlist_items;
DROP POLICY IF EXISTS "Anon can read playlist items for player" ON public.playlist_items;
CREATE POLICY "Anon can read playlist_items of player playlists"
ON public.playlist_items FOR SELECT TO anon
USING (
  (screen_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.screens s WHERE s.id = playlist_items.screen_id AND s.slug IS NOT NULL))
  OR (playlist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.screens s WHERE s.playlist_id = playlist_items.playlist_id AND s.slug IS NOT NULL))
);

-- VIDEO_WALLS
REVOKE SELECT ON public.video_walls FROM anon;
GRANT SELECT (id, name, rows, cols, establishment_id, wall_layout_mode, created_at) ON public.video_walls TO anon;

-- STORAGE UPLOADS
DROP POLICY IF EXISTS "Anon and authenticated can upload to uploads bucket" ON storage.objects;
CREATE POLICY "Uploads must target existing screen prefix"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND name ~ '^screen-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND EXISTS (SELECT 1 FROM public.screens s WHERE s.id::text = substring(name from '^screen-([0-9a-f-]{36})/'))
);

-- SECURITY DEFINER function EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.establishment_role(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_establishment(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_access_code_for_screen(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.establishment_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_establishment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_access_code_for_screen(text, uuid) TO anon, authenticated;
