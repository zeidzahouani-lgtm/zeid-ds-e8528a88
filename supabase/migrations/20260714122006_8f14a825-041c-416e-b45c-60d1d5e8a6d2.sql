GRANT EXECUTE ON FUNCTION public.generate_screen_slug() TO authenticated;

UPDATE public.screens
SET slug = lower(regexp_replace(regexp_replace(coalesce(name, id::text), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL OR trim(slug) = '';

DROP POLICY IF EXISTS "Anon can read layouts used by screens" ON public.layouts;
CREATE POLICY "Anon can read layouts used by screens"
ON public.layouts
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.screens s
    WHERE s.layout_id = layouts.id
  )
);

DROP POLICY IF EXISTS "Anon can read layout_regions of player layouts" ON public.layout_regions;
CREATE POLICY "Anon can read layout_regions of player layouts"
ON public.layout_regions
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.layouts l
    JOIN public.screens s ON s.layout_id = l.id
    WHERE l.id = layout_regions.layout_id
  )
);

DROP POLICY IF EXISTS "Anon can read playlist_items of player playlists" ON public.playlist_items;
CREATE POLICY "Anon can read playlist_items of player playlists"
ON public.playlist_items
FOR SELECT
TO anon
USING (
  (
    screen_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.screens s
      WHERE s.id = playlist_items.screen_id
    )
  )
  OR
  (
    playlist_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.screens s
      WHERE s.playlist_id = playlist_items.playlist_id
    )
  )
);

DROP POLICY IF EXISTS "Anon can read schedules of player screens" ON public.schedules;
CREATE POLICY "Anon can read schedules of player screens"
ON public.schedules
FOR SELECT
TO anon
USING (
  (
    screen_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.screens s
      WHERE s.id = schedules.screen_id
    )
  )
  OR
  (
    playlist_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.screens s
      WHERE s.playlist_id = schedules.playlist_id
    )
  )
  OR
  (
    program_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.screens s
      WHERE s.program_id = schedules.program_id
    )
  )
);

REVOKE SELECT ON public.media FROM anon;
GRANT SELECT (id, name, type, url, duration, created_at) ON public.media TO anon;