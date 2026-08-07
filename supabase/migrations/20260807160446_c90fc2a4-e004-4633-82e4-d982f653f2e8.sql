DROP POLICY IF EXISTS "Anon uploads only while screen QR fallback is active" ON storage.objects;

CREATE POLICY "QR uploads to existing screen with active access code"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND name ~ '^screen-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id::text = substring(storage.objects.name, '^screen-([0-9a-f-]{36})/')
      AND (
        (auth.uid() IS NOT NULL AND s.establishment_id IS NOT NULL AND public.is_member_of(auth.uid(), s.establishment_id))
        OR (s.fallback_since IS NOT NULL AND s.fallback_since > now() - interval '1 hour')
        OR EXISTS (
          SELECT 1 FROM public.access_codes ac
          LEFT JOIN public.user_establishments ue ON ue.user_id = ac.user_id
          WHERE ac.is_active = true
            AND (ac.user_id IS NULL OR ue.establishment_id = s.establishment_id)
        )
      )
  )
);