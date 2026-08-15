ALTER TABLE public.access_codes ADD COLUMN IF NOT EXISTS starts_at timestamptz;

DROP FUNCTION IF EXISTS public.validate_access_code_for_screen(text, uuid);

CREATE OR REPLACE FUNCTION public.validate_access_code_for_screen(_code text, _screen_id uuid)
RETURNS TABLE(id uuid, code text, user_name text, user_id uuid, is_active boolean, starts_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_screen_est uuid;
BEGIN
  SELECT establishment_id INTO v_screen_est FROM public.screens WHERE screens.id = _screen_id;

  RETURN QUERY
  SELECT ac.id, ac.code, ac.user_name, ac.user_id, ac.is_active, ac.starts_at, ac.expires_at
  FROM public.access_codes ac
  WHERE ac.code = upper(trim(_code))
    AND ac.is_active = true
    AND (ac.starts_at IS NULL OR ac.starts_at <= now())
    AND (ac.expires_at IS NULL OR ac.expires_at > now())
    AND (
      ac.screen_ids IS NULL
      OR cardinality(ac.screen_ids) = 0
      OR _screen_id = ANY (ac.screen_ids)
    )
    AND (
      ac.establishment_id IS NULL
      OR v_screen_est IS NULL
      OR ac.establishment_id = v_screen_est
    )
    AND (
      ac.user_id IS NULL
      OR v_screen_est IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_establishments ue
        WHERE ue.user_id = ac.user_id
          AND ue.establishment_id = v_screen_est
      )
      OR public.has_role(ac.user_id, 'admin')
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_access_code_for_screen(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_access_code_for_screen(text, uuid) TO anon, authenticated, service_role;