GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.establishment_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_establishment(uuid, uuid) TO authenticated;