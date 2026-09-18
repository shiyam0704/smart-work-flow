
-- Test helper: create/delete synthetic auth.users rows so RLS tests can
-- impersonate users. SECURITY DEFINER (owned by postgres) is required
-- because normal roles cannot write to the auth schema. Lives in `private`
-- and EXECUTE is revoked from anon/authenticated so it is not callable via
-- PostgREST.
CREATE OR REPLACE FUNCTION private.rls_test_create_user(_id uuid, _email text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS $$
  INSERT INTO auth.users(id, instance_id, aud, role, email)
  VALUES (_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', _email)
  ON CONFLICT (id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION private.rls_test_delete_user(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS $$
  DELETE FROM auth.users WHERE id = _id;
$$;

REVOKE EXECUTE ON FUNCTION private.rls_test_create_user(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.rls_test_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.rls_test_create_user(uuid, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.rls_test_delete_user(uuid) TO postgres, service_role;
