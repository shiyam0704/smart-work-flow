GRANT EXECUTE ON FUNCTION private.is_executive_or_above(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_manager_or_above(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION private.is_executive_or_above(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_manager_or_above(uuid) FROM PUBLIC;