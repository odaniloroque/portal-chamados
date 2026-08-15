REVOKE EXECUTE ON FUNCTION public.can_access_contract(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_contract(uuid, uuid) TO authenticated, service_role;