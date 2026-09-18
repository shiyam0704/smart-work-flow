-- Tenant-isolation RLS tests.
-- Runs as the postgres role, but each assertion block SETs LOCAL ROLE to
-- `authenticated` and injects a synthetic JWT (`request.jwt.claims`) so
-- `auth.uid()` returns the impersonated user. Verifies that a provisioned
-- employee at Company A cannot read, insert, update, or delete rows that
-- belong to Company B, and that a super admin can access both.
--
-- Any assertion failure raises an exception → non-zero psql exit code.

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------- fixtures
-- Two companies, two employee users (one per company), one super admin.
DO $$
DECLARE
  co_a uuid := gen_random_uuid();
  co_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  user_super uuid := gen_random_uuid();
  client_a uuid;
  client_b uuid;
  project_a uuid;
  project_b uuid;
  visible_count int;
  update_count int;
  delete_count int;
  inserted_company uuid;
BEGIN
  -- Companies
  INSERT INTO public.companies(id, name, slug) VALUES (co_a, 'RLS Test A', 'rls-test-a-'||substr(co_a::text,1,8));
  INSERT INTO public.companies(id, name, slug) VALUES (co_b, 'RLS Test B', 'rls-test-b-'||substr(co_b::text,1,8));

  -- Synthetic auth.users rows so FKs to auth.users(id) resolve.
  -- Uses the private SECURITY DEFINER helper (not exposed via the API).
  PERFORM private.rls_test_create_user(user_a,     'rls-alice-'||user_a||'@test.local');
  PERFORM private.rls_test_create_user(user_b,     'rls-bob-'||user_b||'@test.local');
  PERFORM private.rls_test_create_user(user_super, 'rls-root-'||user_super||'@test.local');

  -- Employees (provisioned via employees table, scoped to their company)
  INSERT INTO public.employees(user_id, name, email, company_id) VALUES (user_a, 'Alice', 'alice@a.test', co_a);
  INSERT INTO public.employees(user_id, name, email, company_id) VALUES (user_b, 'Bob',   'bob@b.test',   co_b);

  -- Super admin
  INSERT INTO public.user_roles(user_id, role) VALUES (user_super, 'super_admin');

  -- Seed one client + one project per company (as super admin via direct insert,
  -- bypassing the trigger by specifying company_id explicitly)
  INSERT INTO public.clients(name, company_id) VALUES ('Client A', co_a) RETURNING id INTO client_a;
  INSERT INTO public.clients(name, company_id) VALUES ('Client B', co_b) RETURNING id INTO client_b;
  INSERT INTO public.projects(name, client_id, company_id) VALUES ('Project A', client_a, co_a) RETURNING id INTO project_a;
  INSERT INTO public.projects(name, client_id, company_id) VALUES ('Project B', client_b, co_b) RETURNING id INTO project_b;
  INSERT INTO public.project_payments(project_id, amount, paid_on, company_id)
    VALUES (project_a, 100, current_date, co_a);
  INSERT INTO public.project_payments(project_id, amount, paid_on, company_id)
    VALUES (project_b, 200, current_date, co_b);

  -- ============================================================ Alice (Co A)
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role','authenticated')::text, true);

  -- 1. SELECT isolation: Alice only sees Company A rows
  SELECT count(*) INTO visible_count FROM public.clients;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'clients SELECT leak: Alice sees % rows, expected 1', visible_count;
  END IF;

  SELECT count(*) INTO visible_count FROM public.projects;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'projects SELECT leak: Alice sees % rows, expected 1', visible_count;
  END IF;

  SELECT count(*) INTO visible_count FROM public.project_payments;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'project_payments SELECT leak: Alice sees % rows, expected 1', visible_count;
  END IF;

  SELECT count(*) INTO visible_count FROM public.employees;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'employees SELECT leak: Alice sees % rows, expected 1', visible_count;
  END IF;

  -- 2. UPDATE isolation: cannot touch Company B rows (RLS filters them out)
  UPDATE public.clients SET name = 'HACKED' WHERE id = client_b;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 0 THEN
    RAISE EXCEPTION 'clients UPDATE leak: Alice modified % Company B rows', update_count;
  END IF;

  UPDATE public.project_payments SET amount = 999999 WHERE project_id = project_b;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 0 THEN
    RAISE EXCEPTION 'project_payments UPDATE leak: Alice modified % Company B rows', update_count;
  END IF;

  -- 3. DELETE isolation
  DELETE FROM public.projects WHERE id = project_b;
  GET DIAGNOSTICS delete_count = ROW_COUNT;
  IF delete_count <> 0 THEN
    RAISE EXCEPTION 'projects DELETE leak: Alice deleted % Company B rows', delete_count;
  END IF;

  -- 4. INSERT forgery: Alice explicitly targets Company B → must be rejected
  --    by the RLS WITH CHECK clause.
  BEGIN
    INSERT INTO public.clients(name, company_id) VALUES ('Forged', co_b);
    RAISE EXCEPTION 'INSERT forgery: Alice inserted into Company B without error';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    IF SQLSTATE NOT IN ('42501','23514','42P17') THEN
      -- RLS violations surface as 42501 (insufficient_privilege).
      IF SQLERRM NOT LIKE '%row-level security%' THEN
        RAISE;
      END IF;
    END IF;
  END;

  -- 5. INSERT without company_id → trigger auto-stamps Alice's company
  INSERT INTO public.clients(name) VALUES ('Auto-stamped')
    RETURNING company_id INTO inserted_company;
  IF inserted_company <> co_a THEN
    RAISE EXCEPTION 'auto-stamp trigger set company_id=% (expected %)', inserted_company, co_a;
  END IF;

  -- 6. INSERT with explicit own company_id still works
  INSERT INTO public.clients(name, company_id) VALUES ('Own client', co_a)
    RETURNING company_id INTO inserted_company;
  IF inserted_company <> co_a THEN
    RAISE EXCEPTION 'legit INSERT failed to land in own company';
  END IF;

  -- ============================================================ Bob (Co B)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role','authenticated')::text, true);

  SELECT count(*) INTO visible_count FROM public.clients WHERE id = client_a;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'Bob can see Company A client';
  END IF;

  -- Bob cannot forge Alice's client_id into a payment (payment insert stamps Bob's company;
  -- project_id belongs to Company A, but RLS check is on payment.company_id vs Bob's company_id.
  -- The row lands in Bob's company but references a foreign project — application-level FK
  -- is fine; the important isolation is that Bob cannot read/mutate Company A payments.)
  UPDATE public.project_payments SET amount = 1 WHERE project_id = project_a;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 0 THEN
    RAISE EXCEPTION 'project_payments UPDATE leak: Bob modified % Company A rows', update_count;
  END IF;

  -- ============================================================ Super admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_super::text, 'role','authenticated')::text, true);

  SELECT count(*) INTO visible_count FROM public.clients WHERE id IN (client_a, client_b);
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'super admin cannot see both companies (saw %)', visible_count;
  END IF;

  SELECT count(*) INTO visible_count FROM public.project_payments WHERE project_id IN (project_a, project_b);
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'super admin cannot see both companies'' payments (saw %)', visible_count;
  END IF;

  -- ============================================================ Anonymous
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT count(*) INTO visible_count FROM public.clients WHERE id IN (client_a, client_b);
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'anon can see % client rows, expected 0', visible_count;
  END IF;

  RAISE NOTICE 'All tenant-isolation RLS assertions passed.';
END $$;

-- Roll back all fixtures — the test leaves no residue in the database.
ROLLBACK;