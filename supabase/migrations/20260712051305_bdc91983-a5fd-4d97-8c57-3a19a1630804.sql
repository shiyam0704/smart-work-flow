
GRANT USAGE ON SCHEMA private TO sandbox_exec;
GRANT EXECUTE ON FUNCTION private.rls_test_create_user(uuid, text) TO sandbox_exec;
GRANT EXECUTE ON FUNCTION private.rls_test_delete_user(uuid) TO sandbox_exec;
