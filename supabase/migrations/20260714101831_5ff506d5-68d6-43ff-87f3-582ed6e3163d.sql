
-- Fix 1: Allow anon to read whitelisted, non-sensitive columns from establishments so the player can render the correct establishment logo
GRANT SELECT (id, name, logo_url, updated_at, created_at) ON public.establishments TO anon;

-- Fix 2: Repair the uploads bucket INSERT policy. The previous version referenced screens.name instead of the storage object's name, causing all anonymous QR uploads to fail.
DROP POLICY IF EXISTS "Uploads must target existing screen prefix" ON storage.objects;

CREATE POLICY "Uploads must target existing screen prefix"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'uploads'
  AND name ~ '^screen-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id::text = substring(storage.objects.name from '^screen-([0-9a-f-]{36})/')
  )
);
