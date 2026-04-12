-- Add fallback tracking columns
ALTER TABLE public.screens
  ADD COLUMN fallback_since timestamptz DEFAULT NULL,
  ADD COLUMN fallback_notified boolean NOT NULL DEFAULT false;

-- Function to check screens in fallback > 1 minute and create notifications
CREATE OR REPLACE FUNCTION public.check_fallback_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (establishment_id, screen_id, type, title, message)
  SELECT
    s.establishment_id,
    s.id,
    'screen_fallback',
    'Écran en mode secours',
    'L''écran "' || s.name || '" affiche le QR code de secours depuis plus d''une minute.'
  FROM public.screens s
  WHERE s.fallback_since IS NOT NULL
    AND s.fallback_since < now() - interval '1 minute'
    AND s.fallback_notified = false
    AND s.establishment_id IS NOT NULL
    AND s.status = 'online';

  -- Mark as notified to avoid duplicates
  UPDATE public.screens
  SET fallback_notified = true
  WHERE fallback_since IS NOT NULL
    AND fallback_since < now() - interval '1 minute'
    AND fallback_notified = false
    AND establishment_id IS NOT NULL
    AND status = 'online';
END;
$$;