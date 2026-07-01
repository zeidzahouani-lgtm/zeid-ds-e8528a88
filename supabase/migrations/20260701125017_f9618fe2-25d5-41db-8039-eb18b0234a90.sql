
CREATE OR REPLACE FUNCTION public.validate_access_code_for_screen(_code text, _screen_id uuid)
RETURNS TABLE (id uuid, code text, user_name text, user_id uuid, is_active boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screen_est uuid;
BEGIN
  SELECT establishment_id INTO v_screen_est FROM public.screens WHERE screens.id = _screen_id;

  RETURN QUERY
  SELECT ac.id, ac.code, ac.user_name, ac.user_id, ac.is_active
  FROM public.access_codes ac
  WHERE ac.code = upper(trim(_code))
    AND ac.is_active = true
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
$$;

GRANT EXECUTE ON FUNCTION public.validate_access_code_for_screen(text, uuid) TO anon, authenticated;
