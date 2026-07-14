CREATE OR REPLACE FUNCTION public.validate_license_for_screen(_screen_id uuid)
RETURNS TABLE(valid boolean, message text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_license boolean;
  v_has_valid_license boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.licenses l
    WHERE l.screen_id = _screen_id
      AND l.is_active = true
  ) INTO v_has_license;

  IF NOT v_has_license THEN
    RETURN QUERY SELECT false, 'Aucune licence associée à cet écran'::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.licenses l
    WHERE l.screen_id = _screen_id
      AND l.is_active = true
      AND l.valid_from <= now()
      AND l.valid_until >= now()
  ) INTO v_has_valid_license;

  IF NOT v_has_valid_license THEN
    RETURN QUERY SELECT false, 'Licence expirée'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_license_for_screen(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_license_by_key(_license_key text, _screen_id uuid)
RETURNS TABLE(valid boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_license public.licenses%ROWTYPE;
  v_screen_est uuid;
  v_updated int;
BEGIN
  SELECT * INTO v_license
  FROM public.licenses
  WHERE license_key = upper(trim(_license_key))
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Clé de licence introuvable ou désactivée'::text;
    RETURN;
  END IF;

  IF v_license.valid_until < now() THEN
    RETURN QUERY SELECT false, 'Cette licence est expirée'::text;
    RETURN;
  END IF;

  IF v_license.screen_id IS NOT NULL AND v_license.screen_id <> _screen_id THEN
    RETURN QUERY SELECT false, 'Cette licence est déjà assignée à un autre écran'::text;
    RETURN;
  END IF;

  SELECT establishment_id INTO v_screen_est
  FROM public.screens
  WHERE id = _screen_id;

  IF v_license.establishment_id IS NOT NULL
     AND v_screen_est IS NOT NULL
     AND v_license.establishment_id <> v_screen_est THEN
    RETURN QUERY SELECT false, 'Cette licence appartient à un autre établissement'::text;
    RETURN;
  END IF;

  IF v_license.screen_id IS NULL THEN
    UPDATE public.licenses
       SET screen_id = _screen_id,
           activated_at = now()
     WHERE id = v_license.id
       AND screen_id IS NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      RETURN QUERY SELECT false, 'Cette licence vient d’être assignée à un autre écran'::text;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_license_by_key(text, uuid) TO anon, authenticated, service_role;