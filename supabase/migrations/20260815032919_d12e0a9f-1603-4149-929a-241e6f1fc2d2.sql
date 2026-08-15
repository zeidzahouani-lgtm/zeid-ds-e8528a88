CREATE OR REPLACE FUNCTION public.expire_access_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids
  FROM public.access_codes
  WHERE expires_at IS NOT NULL AND expires_at <= now();

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.access_codes
     SET is_active = false
   WHERE id = ANY(v_ids) AND is_active = true;

  UPDATE public.contents c
     SET status = 'rejected',
         end_time = LEAST(COALESCE(c.end_time, now()), now())
   WHERE c.source = 'qr_upload'
     AND (c.metadata->>'access_code_id')::uuid = ANY(v_ids)
     AND c.status <> 'rejected';

  UPDATE public.screens s
     SET current_media_id = NULL
   WHERE s.current_media_id IS NULL AND false;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_access_codes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_access_codes() TO service_role;