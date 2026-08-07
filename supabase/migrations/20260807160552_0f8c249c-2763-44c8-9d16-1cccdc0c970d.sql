DROP POLICY IF EXISTS "Anon can insert content on fallback screens" ON public.contents;

CREATE POLICY "Anon can insert content via QR upload"
ON public.contents FOR INSERT
TO anon
WITH CHECK (
  screen_id IS NOT NULL
  AND image_url IS NOT NULL
  AND sender_email IS NULL
  AND user_id IS NULL
  AND status IN ('pending'::content_status, 'active'::content_status)
  AND public.can_qr_upload_to_screen(screen_id)
);