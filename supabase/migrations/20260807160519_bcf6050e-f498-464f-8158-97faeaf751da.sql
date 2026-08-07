CREATE OR REPLACE FUNCTION public.can_qr_upload_to_screen(_screen_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = _screen_id
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
  );
$$;

REVOKE ALL ON FUNCTION public.can_qr_upload_to_screen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_qr_upload_to_screen(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "QR uploads to existing screen with active access code" ON storage.objects;

CREATE POLICY "QR uploads to existing screen with active access code"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND name ~ '^screen-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND public.can_qr_upload_to_screen(
    substring(storage.objects.name, '^screen-([0-9a-f-]{36})/')::uuid
  )
);