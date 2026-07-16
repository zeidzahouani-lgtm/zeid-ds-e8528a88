
CREATE OR REPLACE FUNCTION public.admin_rls_status()
RETURNS TABLE(table_name text, rls_enabled boolean, policy_count int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT c.relname::text,
         c.relrowsecurity,
         (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rls_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rls_status() TO authenticated;
