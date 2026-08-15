ALTER TABLE public.access_codes
  ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS screen_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE OR REPLACE FUNCTION public.is_establishment_admin(_user_id uuid, _establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.user_establishments ue
        WHERE ue.user_id = _user_id
          AND ue.establishment_id = _establishment_id
          AND ue.role IN ('admin','owner','manager')
      );
$$;

REVOKE ALL ON FUNCTION public.is_establishment_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_establishment_admin(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Establishment admins insert access_codes" ON public.access_codes;
CREATE POLICY "Establishment admins insert access_codes"
ON public.access_codes FOR INSERT TO authenticated
WITH CHECK (
  establishment_id IS NOT NULL
  AND public.is_establishment_admin(auth.uid(), establishment_id)
);

DROP POLICY IF EXISTS "Establishment admins update access_codes" ON public.access_codes;
CREATE POLICY "Establishment admins update access_codes"
ON public.access_codes FOR UPDATE TO authenticated
USING (establishment_id IS NOT NULL AND public.is_establishment_admin(auth.uid(), establishment_id))
WITH CHECK (establishment_id IS NOT NULL AND public.is_establishment_admin(auth.uid(), establishment_id));

DROP POLICY IF EXISTS "Establishment admins delete access_codes" ON public.access_codes;
CREATE POLICY "Establishment admins delete access_codes"
ON public.access_codes FOR DELETE TO authenticated
USING (establishment_id IS NOT NULL AND public.is_establishment_admin(auth.uid(), establishment_id));

DROP POLICY IF EXISTS "Members read establishment access_codes" ON public.access_codes;
CREATE POLICY "Members read establishment access_codes"
ON public.access_codes FOR SELECT TO authenticated
USING (establishment_id IS NOT NULL AND public.is_member_of(auth.uid(), establishment_id));

CREATE OR REPLACE FUNCTION public.validate_access_code_for_screen(_code text, _screen_id uuid)
RETURNS TABLE(id uuid, code text, user_name text, user_id uuid, is_active boolean)
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
$$;