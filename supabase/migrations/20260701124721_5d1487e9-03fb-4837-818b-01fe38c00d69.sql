
-- Helper: check if two users share at least one establishment
CREATE OR REPLACE FUNCTION public.shares_establishment(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_establishments ua
    JOIN public.user_establishments ub
      ON ua.establishment_id = ub.establishment_id
    WHERE ua.user_id = _a AND ub.user_id = _b
  )
$$;

-- Rebuild SELECT policies on access_codes
DROP POLICY IF EXISTS "Anyone can read active access_codes" ON public.access_codes;
DROP POLICY IF EXISTS "Anon can read access_codes for upload" ON public.access_codes;
DROP POLICY IF EXISTS "Users read own or team access_codes" ON public.access_codes;
DROP POLICY IF EXISTS "Marketing read own access_codes" ON public.access_codes;
DROP POLICY IF EXISTS "Admins read all access_codes" ON public.access_codes;

-- Anonymous users (QR upload flow) must still resolve a code
CREATE POLICY "Anon can read access_codes for upload"
ON public.access_codes
FOR SELECT
TO anon
USING (is_active = true);

-- Admins see everything
CREATE POLICY "Admins read all access_codes"
ON public.access_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Marketing users see ONLY their own code
CREATE POLICY "Marketing read own access_codes"
ON public.access_codes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'marketing')
  AND user_id = auth.uid()
);

-- Regular users (not marketing, not admin) see their own code + team members
CREATE POLICY "Users read own or team access_codes"
ON public.access_codes
FOR SELECT
TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'admin')
  AND NOT public.has_role(auth.uid(), 'marketing')
  AND (
    user_id = auth.uid()
    OR (user_id IS NOT NULL AND public.shares_establishment(auth.uid(), user_id))
  )
);
