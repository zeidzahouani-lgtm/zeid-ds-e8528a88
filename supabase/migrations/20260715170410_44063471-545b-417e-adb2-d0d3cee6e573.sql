
-- 1. Restrict anon insert on contents to screens actively in fallback mode
DROP POLICY IF EXISTS "Anon can insert via webhook" ON public.contents;
CREATE POLICY "Anon can insert content on fallback screens"
ON public.contents
FOR INSERT
TO anon
WITH CHECK (
  screen_id IS NOT NULL
  AND image_url IS NOT NULL
  AND status = 'pending'::content_status
  AND sender_email IS NULL
  AND user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = contents.screen_id
      AND s.fallback_since IS NOT NULL
      AND s.fallback_since > now() - interval '1 hour'
  )
);

-- 2. Scope storage list to owner or establishment members
DROP POLICY IF EXISTS "Authenticated users can list media buckets" ON storage.objects;
CREATE POLICY "Users list own or establishment media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['media','uploads'])
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.establishment_id IS NOT NULL
        AND public.is_member_of(auth.uid(), s.establishment_id)
        AND (storage.objects.name LIKE s.id::text || '/%'
             OR storage.objects.name LIKE 'screens/' || s.id::text || '/%')
    )
    OR EXISTS (
      SELECT 1 FROM public.media m
      WHERE m.establishment_id IS NOT NULL
        AND public.is_member_of(auth.uid(), m.establishment_id)
        AND m.url LIKE '%/' || storage.objects.name
    )
  )
);
