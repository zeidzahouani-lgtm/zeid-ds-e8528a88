
-- 1. app_settings: restrict public reads to safe branding keys
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Public branding keys readable" ON public.app_settings
  FOR SELECT TO anon, authenticated
  USING (key IN (
    'app_name','app_tagline','logo_url','favicon_url','primary_color','accent_color',
    'welcome_message','page_title','login_video_url','default_gmt_offset','player_port',
    'show_signature_on_player'
  ));

-- 2. establishment_settings: anon reads only for brand_* keys
DROP POLICY IF EXISTS "Anon can read establishment settings for player" ON public.establishment_settings;
CREATE POLICY "Anon can read branding settings" ON public.establishment_settings
  FOR SELECT TO anon
  USING (key LIKE 'brand_%');

-- 3. establishments: column-level anon reads (id, name, logo_url, updated_at)
REVOKE SELECT ON public.establishments FROM anon;
GRANT SELECT (id, name, logo_url, updated_at) ON public.establishments TO anon;

-- 4. access_codes: remove blanket anon read; RPC validate_access_code_for_screen is used
DROP POLICY IF EXISTS "Anon can read access_codes for upload" ON public.access_codes;

-- 5. contents: scope authenticated policies to owner / establishment membership / admin
DROP POLICY IF EXISTS "Authenticated users can read contents" ON public.contents;
DROP POLICY IF EXISTS "Authenticated users can insert contents" ON public.contents;
DROP POLICY IF EXISTS "Authenticated users can update contents" ON public.contents;
DROP POLICY IF EXISTS "Authenticated users can delete contents" ON public.contents;

CREATE POLICY "Admins manage all contents" ON public.contents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own contents" ON public.contents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members read contents on establishment screens" ON public.contents
  FOR SELECT TO authenticated
  USING (screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = contents.screen_id
      AND s.establishment_id IS NOT NULL
      AND is_member_of(auth.uid(), s.establishment_id)
  ));

CREATE POLICY "Users insert own contents" ON public.contents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (screen_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = contents.screen_id
        AND s.establishment_id IS NOT NULL
        AND is_member_of(auth.uid(), s.establishment_id)
    ))
  );

CREATE POLICY "Users update own or establishment contents" ON public.contents
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (screen_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = contents.screen_id
        AND s.establishment_id IS NOT NULL
        AND is_member_of(auth.uid(), s.establishment_id)
    ))
  );

CREATE POLICY "Users delete own or establishment contents" ON public.contents
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (screen_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = contents.screen_id
        AND s.establishment_id IS NOT NULL
        AND is_member_of(auth.uid(), s.establishment_id)
    ))
  );

-- 6. inbox_emails: admin only
DROP POLICY IF EXISTS "Authenticated users can read inbox_emails" ON public.inbox_emails;
DROP POLICY IF EXISTS "Authenticated users can update inbox_emails" ON public.inbox_emails;
DROP POLICY IF EXISTS "Authenticated users can delete inbox_emails" ON public.inbox_emails;
CREATE POLICY "Admins manage inbox_emails" ON public.inbox_emails
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. email_actions: admin only
DROP POLICY IF EXISTS "Authenticated users can read email_actions" ON public.email_actions;
CREATE POLICY "Admins read email_actions" ON public.email_actions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. licenses: tighten anon UPDATE to unassigned/active/valid licenses
DROP POLICY IF EXISTS "Anon can update license screen_id for activation" ON public.licenses;
CREATE POLICY "Anon can claim unassigned license" ON public.licenses
  FOR UPDATE TO anon
  USING (screen_id IS NULL AND is_active = true AND valid_until > now())
  WITH CHECK (is_active = true);

-- 9. screens: restrict anon UPDATE to player status columns
DROP POLICY IF EXISTS "Anyone can update screen status" ON public.screens;
CREATE POLICY "Anon can update player runtime fields" ON public.screens
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
REVOKE UPDATE ON public.screens FROM anon;
GRANT UPDATE (
  status, player_heartbeat_at, player_user_agent, player_session_id,
  player_ip, player_lan_ip, current_media_id, fallback_since, fallback_notified,
  os_type, ip_address, resolution, pending_action, debug_mode, updated_at
) ON public.screens TO anon;

-- 10. playlists / programs / video_walls: hide sensitive columns from anon
REVOKE SELECT ON public.playlists FROM anon;
GRANT SELECT (id, name, establishment_id, created_at) ON public.playlists TO anon;

REVOKE SELECT ON public.programs FROM anon;
GRANT SELECT (id, name, establishment_id, created_at) ON public.programs TO anon;

REVOKE SELECT ON public.video_walls FROM anon;
GRANT SELECT (id, name, cols, rows, wall_layout_mode, establishment_id, created_at, updated_at) ON public.video_walls TO anon;

-- 11. Storage buckets: enforce ownership on writes/deletes; drop broad public listing
DROP POLICY IF EXISTS "Anyone can read media files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload media files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete media files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to uploads bucket" ON storage.objects;

CREATE POLICY "Authenticated users can list media buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('media','uploads'));

CREATE POLICY "Authenticated users can upload to media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND owner = auth.uid());

CREATE POLICY "Owners can update their media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('media','uploads') AND owner = auth.uid());

CREATE POLICY "Owners or admins can delete media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('media','uploads') AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)));

-- uploads bucket still needs anon INSERT for QR-code / access-code upload flow
CREATE POLICY "Anon and authenticated can upload to uploads bucket" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'uploads');

-- 12. Revoke EXECUTE on trigger/cron-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_screen_offline() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_fallback_alerts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_screen_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
