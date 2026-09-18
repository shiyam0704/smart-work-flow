-- Consolidated migrations 1 to 41 for Coolify Supabase database
-- ========================================================
-- Helper: Ensure sandbox_exec role exists so test grants succeed
-- ========================================================
DO 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    CREATE ROLE sandbox_exec;
  END IF;
END
;


-- ========================================================
-- MIGRATION 1 OF 41: 20260712034113_26d8a67c-a497-4ff2-ad69-40d8eedf86db.sql
-- ========================================================

-- Helper: is user provisioned (has any role) or is an employee
CREATE OR REPLACE FUNCTION public.is_provisioned_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid)
    OR EXISTS(SELECT 1 FROM public.employees WHERE user_id = _uid)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','super_admin'));
$$;

-- Tighten SECURITY DEFINER helpers: switch to INVOKER and lock EXECUTE
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='super_admin');
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_provisioned_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_provisioned_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;

-- Drop all overly permissive policies
DROP POLICY IF EXISTS "cli all" ON public.clients;
DROP POLICY IF EXISTS "emp all" ON public.employees;
DROP POLICY IF EXISTS "lead all" ON public.leads;
DROP POLICY IF EXISTS "la all" ON public.lead_attachments;
DROP POLICY IF EXISTS "lse all" ON public.lead_stage_entries;
DROP POLICY IF EXISTS "proj all" ON public.projects;
DROP POLICY IF EXISTS "pa all" ON public.project_attachments;
DROP POLICY IF EXISTS "pc all" ON public.project_comments;
DROP POLICY IF EXISTS "pp all" ON public.project_payments;
DROP POLICY IF EXISTS "task all" ON public.tasks;
DROP POLICY IF EXISTS "taa all" ON public.task_attachments;
DROP POLICY IF EXISTS "tc all" ON public.task_comments;
DROP POLICY IF EXISTS "ta all" ON public.task_assignees;
DROP POLICY IF EXISTS "dept all" ON public.departments;
DROP POLICY IF EXISTS "cg all" ON public.client_groups;
DROP POLICY IF EXISTS "cfd all" ON public.client_field_definitions;
DROP POLICY IF EXISTS "efd all" ON public.employee_field_definitions;
DROP POLICY IF EXISTS "lfd all" ON public.lead_field_definitions;
DROP POLICY IF EXISTS "pfd all" ON public.project_field_definitions;
DROP POLICY IF EXISTS "tt all" ON public.task_types;
DROP POLICY IF EXISTS "ws all" ON public.workflow_states;
DROP POLICY IF EXISTS "pd all" ON public.project_departments;
DROP POLICY IF EXISTS "pt all" ON public.project_templates;
DROP POLICY IF EXISTS "ptt all" ON public.project_template_tasks;
DROP POLICY IF EXISTS "ptta all" ON public.project_template_task_assignees;
DROP POLICY IF EXISTS "companies read" ON public.companies;
DROP POLICY IF EXISTS "cm read" ON public.company_modules;
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
DROP POLICY IF EXISTS "rp read" ON public.role_permissions;
DROP POLICY IF EXISTS "urd manage" ON public.user_role_departments;
DROP POLICY IF EXISTS "urd read" ON public.user_role_departments;

-- Data tables: full access for provisioned users only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','employees','leads','lead_attachments','lead_stage_entries',
    'projects','project_attachments','project_comments','project_payments',
    'tasks','task_attachments','task_comments','task_assignees'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s provisioned all" ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_provisioned_user(auth.uid()))
        WITH CHECK (public.is_provisioned_user(auth.uid()));
    $f$, t);
  END LOOP;
END $$;

-- Reference/config tables: read for provisioned, write for admins
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments','client_groups','client_field_definitions','employee_field_definitions',
    'lead_field_definitions','project_field_definitions','task_types','workflow_states',
    'project_departments','project_templates','project_template_tasks','project_template_task_assignees'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s read provisioned" ON public.%1$I
        FOR SELECT TO authenticated
        USING (public.is_provisioned_user(auth.uid()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s write admin" ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_admin_or_super(auth.uid()))
        WITH CHECK (public.is_admin_or_super(auth.uid()));
    $f$, t);
  END LOOP;
END $$;

-- Companies + modules read: provisioned users only
CREATE POLICY "companies read provisioned" ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_provisioned_user(auth.uid()));

CREATE POLICY "company_modules read provisioned" ON public.company_modules
  FOR SELECT TO authenticated
  USING (public.is_provisioned_user(auth.uid()));

-- Profiles read: provisioned users only (own row always OK via is_provisioned check + separate insert/update policies remain)
CREATE POLICY "profiles read provisioned" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_provisioned_user(auth.uid()));

-- Role permissions: read for provisioned (needed for permission checks app-wide); writes already restricted to super admin
CREATE POLICY "role_permissions read provisioned" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.is_provisioned_user(auth.uid()));

-- user_role_departments: read for provisioned, manage by admins
CREATE POLICY "urd read provisioned" ON public.user_role_departments
  FOR SELECT TO authenticated
  USING (public.is_provisioned_user(auth.uid()));

CREATE POLICY "urd manage admin" ON public.user_role_departments
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));


-- ========================================================
-- MIGRATION 2 OF 41: 20260712034135_3c3a71ab-9c12-49ac-a69a-94aba5bdb7a6.sql
-- ========================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM authenticated;


-- ========================================================
-- MIGRATION 3 OF 41: 20260712034201_81af6d0e-bddb-48e3-8796-6dc2792eecdd.sql
-- ========================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','super_admin'));
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC, anon;


-- ========================================================
-- MIGRATION 4 OF 41: 20260712040708_7da2bb9e-8b35-47cf-b43b-5aec28a17c77.sql
-- ========================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='super_admin');
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','super_admin'));
$$;


-- ========================================================
-- MIGRATION 5 OF 41: 20260712050900_dfda69e7-a246-4e80-bd20-da8a60e91666.sql
-- ========================================================

-- 1. Drop plaintext password
ALTER TABLE public.company_admins DROP COLUMN IF EXISTS password;

-- 2. Add company_id columns first (before helper functions reference them)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'employees','clients','client_groups','client_field_definitions',
    'employee_field_definitions','lead_field_definitions','project_field_definitions',
    'leads','lead_stage_entries','lead_attachments',
    'projects','project_payments','project_attachments','project_comments',
    'project_departments','project_templates','project_template_tasks',
    'project_template_task_assignees',
    'tasks','task_assignees','task_attachments','task_comments','task_types',
    'departments','workflow_states','role_permissions','user_role_departments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE',
      t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(company_id)', 'idx_'||t||'_company_id', t);
  END LOOP;
END $$;

-- 3. Private schema with role/tenant helpers (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role='super_admin'); $$;

CREATE OR REPLACE FUNCTION private.is_admin_or_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','super_admin')); $$;

CREATE OR REPLACE FUNCTION private.has_role(_uid uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role=_role); $$;

CREATE OR REPLACE FUNCTION private.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.employees WHERE user_id = auth.uid() AND company_id IS NOT NULL LIMIT 1),
    (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND company_id IS NOT NULL LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION private.is_provisioned_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid)
    OR EXISTS(SELECT 1 FROM public.employees WHERE user_id = _uid)
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid),
                         private.is_admin_or_super(uuid),
                         private.has_role(uuid, public.app_role),
                         private.current_company_id(),
                         private.is_provisioned_user(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_provisioned_user(uuid) FROM PUBLIC, anon, authenticated;

-- 4. Trigger to auto-fill company_id from caller's company
CREATE OR REPLACE FUNCTION private.set_company_id_from_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := private.current_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'employees','clients','client_groups','client_field_definitions',
    'employee_field_definitions','lead_field_definitions','project_field_definitions',
    'leads','lead_stage_entries','lead_attachments',
    'projects','project_payments','project_attachments','project_comments',
    'project_departments','project_templates','project_template_tasks',
    'project_template_task_assignees',
    'tasks','task_assignees','task_attachments','task_comments','task_types',
    'departments','workflow_states','role_permissions','user_role_departments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_company_id ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user()',
      t, t
    );
  END LOOP;
END $$;

-- 5. Rewrite RLS policies
DO $$
DECLARE
  r record;
  targets text[] := ARRAY[
    'employees','clients','client_groups','client_field_definitions',
    'employee_field_definitions','lead_field_definitions','project_field_definitions',
    'leads','lead_stage_entries','lead_attachments',
    'projects','project_payments','project_attachments','project_comments',
    'project_departments','project_templates','project_template_tasks',
    'project_template_task_assignees',
    'tasks','task_assignees','task_attachments','task_comments','task_types',
    'departments','workflow_states','role_permissions','user_role_departments',
    'companies','company_admins','company_modules','user_roles','profiles'
  ];
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(targets)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles
CREATE POLICY "profiles select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.is_super_admin(auth.uid()));
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "user_roles select own or super" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_super_admin(auth.uid()));
CREATE POLICY "user_roles super manage" ON public.user_roles FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- companies
CREATE POLICY "companies read own" ON public.companies FOR SELECT TO authenticated
  USING (private.is_super_admin(auth.uid()) OR id = private.current_company_id());
CREATE POLICY "companies super manage" ON public.companies FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- company_admins (super admin only)
CREATE POLICY "company_admins super only" ON public.company_admins FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- company_modules
CREATE POLICY "company_modules read own" ON public.company_modules FOR SELECT TO authenticated
  USING (private.is_super_admin(auth.uid()) OR company_id = private.current_company_id());
CREATE POLICY "company_modules super manage" ON public.company_modules FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- Company-scoped policies
DO $$
DECLARE
  t text;
  admin_write_tables text[] := ARRAY[
    'departments','client_groups','client_field_definitions',
    'employee_field_definitions','lead_field_definitions','project_field_definitions',
    'task_types','workflow_states','project_departments','project_templates',
    'project_template_tasks','project_template_task_assignees','role_permissions',
    'user_role_departments'
  ];
  all_tables text[] := ARRAY[
    'employees','clients','leads','lead_stage_entries','lead_attachments',
    'projects','project_payments','project_attachments','project_comments',
    'tasks','task_assignees','task_attachments','task_comments'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s company scoped" ON public.%1$I FOR ALL TO authenticated
      USING (
        private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id())
      )
      WITH CHECK (
        private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id())
      )
    $f$, t);
  END LOOP;

  FOREACH t IN ARRAY admin_write_tables LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s read company" ON public.%1$I FOR SELECT TO authenticated
      USING (
        private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id())
      )
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s admin write company" ON public.%1$I FOR ALL TO authenticated
      USING (
        private.is_super_admin(auth.uid())
        OR (private.is_admin_or_super(auth.uid()) AND company_id = private.current_company_id())
      )
      WITH CHECK (
        private.is_super_admin(auth.uid())
        OR (private.is_admin_or_super(auth.uid()) AND company_id = private.current_company_id())
      )
    $f$, t);
  END LOOP;
END $$;


-- ========================================================
-- MIGRATION 6 OF 41: 20260712051224_02f39c0f-41dd-4002-99fd-6724c7ccc77b.sql
-- ========================================================

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


-- ========================================================
-- MIGRATION 7 OF 41: 20260712051305_bdc91983-a5fd-4d97-8c57-3a19a1630804.sql
-- ========================================================

GRANT USAGE ON SCHEMA private TO sandbox_exec;
GRANT EXECUTE ON FUNCTION private.rls_test_create_user(uuid, text) TO sandbox_exec;
GRANT EXECUTE ON FUNCTION private.rls_test_delete_user(uuid) TO sandbox_exec;


-- ========================================================
-- MIGRATION 8 OF 41: 20260712051327_d2b3a961-090c-44b7-bd3d-f24a45e9c4ae.sql
-- ========================================================

GRANT authenticated TO sandbox_exec;
GRANT anon TO sandbox_exec;


-- ========================================================
-- MIGRATION 9 OF 41: 20260712060543_cb0ea78e-be48-42c6-903f-10855be0b9e4.sql
-- ========================================================

DROP FUNCTION IF EXISTS public.get_company_branding(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_company_branding CASCADE;
CREATE OR REPLACE FUNCTION public.get_company_branding(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, logo_url, status::text
  FROM public.companies
  WHERE slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_branding(text) TO anon, authenticated;


-- ========================================================
-- MIGRATION 10 OF 41: 20260712065254_43c56b1e-84cf-4deb-b47c-3630a58459bf.sql
-- ========================================================

DROP FUNCTION IF EXISTS public.get_company_branding(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_company_branding CASCADE;

-- 1) Convert get_company_branding to SECURITY INVOKER and add a public-branding SELECT policy on companies
--    so anonymous per-company landing pages still resolve name/logo/status without a SECURITY DEFINER bypass.
CREATE OR REPLACE FUNCTION public.get_company_branding(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, status text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT id, name, slug, logo_url, status::text
  FROM public.companies
  WHERE slug = _slug
  LIMIT 1;
$function$;

DROP POLICY IF EXISTS "companies public branding" ON public.companies;
CREATE POLICY "companies public branding" ON public.companies
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2) company_admins: allow same-company users to read their own company's admin contacts
DROP POLICY IF EXISTS "company_admins read own company" ON public.company_admins;
CREATE POLICY "company_admins read own company" ON public.company_admins
  FOR SELECT
  TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (company_id IS NOT NULL AND company_id = private.current_company_id())
  );

-- 3) employees: explicit self-access via user_id (independent of company context resolution)
DROP POLICY IF EXISTS "employees self access" ON public.employees;
CREATE POLICY "employees self access" ON public.employees
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ========================================================
-- MIGRATION 11 OF 41: 20260712071821_ea0a0d27-2a76-437e-b06f-f80d34caddb8.sql
-- ========================================================

DROP FUNCTION IF EXISTS public.get_company_branding(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_company_branding CASCADE;

-- Remove overly permissive public SELECT on companies; expose branding only via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "companies public branding" ON public.companies;

CREATE OR REPLACE FUNCTION public.get_company_branding(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, name, slug, logo_url, status::text
  FROM public.companies
  WHERE slug = _slug
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_company_branding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_branding(text) TO anon, authenticated;


-- ========================================================
-- MIGRATION 12 OF 41: 20260712075652_86388a83-a293-45e3-ad52-713b7da8bdc0.sql
-- ========================================================

CREATE POLICY "companies admin update own"
ON public.companies
FOR UPDATE
TO authenticated
USING (id = private.current_company_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = private.current_company_id() AND public.has_role(auth.uid(), 'admin'));


-- ========================================================
-- MIGRATION 13 OF 41: 20260712080322_1fc234e9-4d55-463e-b887-512507ab43c4.sql
-- ========================================================

ALTER TABLE public.tasks                  DROP COLUMN IF EXISTS task_type_id;
ALTER TABLE public.project_template_tasks DROP COLUMN IF EXISTS task_type_id;
DROP TABLE  IF EXISTS public.task_types CASCADE;


-- ========================================================
-- MIGRATION 14 OF 41: 20260712081629_9609a3a5-b572-434f-923a-9a2be43a48f0.sql
-- ========================================================

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;


-- ========================================================
-- MIGRATION 15 OF 41: 20260712083407_3256a9b3-17a8-4800-9af5-ef16efbedcbe.sql
-- ========================================================

-- Allow admins/super_admins of a company to manage objects in company-logos/{company_id}/*
CREATE POLICY "company-logos admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "company-logos admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "company-logos admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Admins/super_admins may also list/read their own company's logo objects
-- (public rendering goes through /api/public/c/{slug}/logo, not direct storage access).
CREATE POLICY "company-logos admin select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);


-- ========================================================
-- MIGRATION 16 OF 41: 20260713134115_270de70a-3554-49a0-915e-b3d5083ff434.sql
-- ========================================================

ALTER TABLE public.role_permissions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_permission_key_key;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_company_role_perm_key UNIQUE (company_id, role, permission_key);


-- ========================================================
-- MIGRATION 17 OF 41: 20260713144323_07b3cfb9-cfeb-4a92-8c1c-b88fddf9e788.sql
-- ========================================================

DROP FUNCTION IF EXISTS public.has_company_role(uuid, app_role, uuid);
DROP FUNCTION IF EXISTS public.has_company_role(uuid, public.app_role, uuid);
DROP FUNCTION IF EXISTS public.has_company_role;

-- Company-scoped role check (admin role must either be global (company_id IS NULL) or bound to the target company)
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id uuid, _role app_role, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (company_id IS NULL OR company_id = _company_id)
  );
$$;

-- 1. Companies: admin update must be scoped to that specific company
DROP POLICY IF EXISTS "companies admin update own" ON public.companies;
CREATE POLICY "companies admin update own"
ON public.companies
FOR UPDATE
TO authenticated
USING (id = private.current_company_id() AND public.has_company_role(auth.uid(), 'admin', id))
WITH CHECK (id = private.current_company_id() AND public.has_company_role(auth.uid(), 'admin', id));

-- 2. Employees: self-select must also match current company
DROP POLICY IF EXISTS "employees self access" ON public.employees;
CREATE POLICY "employees self access"
ON public.employees
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND company_id IS NOT NULL
  AND company_id = private.current_company_id()
);

-- 3. Profiles: allow users to delete their own profile
DROP POLICY IF EXISTS "profiles delete own" ON public.profiles;
CREATE POLICY "profiles delete own"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id OR private.is_super_admin(auth.uid()));


-- ========================================================
-- MIGRATION 18 OF 41: 20260715030736_ee2994ef-5080-489f-beac-5a85eff16e54.sql
-- ========================================================

-- Admin (same-company) can manage user_roles rows
CREATE POLICY "user_roles admin same company manage"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
);

-- Admin (same-company) can manage user_role_departments rows
CREATE POLICY "user_role_departments admin same company manage"
ON public.user_role_departments
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
);

-- Backfill missing role for empl@swf.com so they can log in (if user exists)
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT '3c277708-274f-4e83-a79a-2e5a61c1ec94'::uuid, 'manager'::app_role, 'c1cfe72f-930b-4d60-b567-242b6f0a91a8'::uuid
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '3c277708-274f-4e83-a79a-2e5a61c1ec94'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '3c277708-274f-4e83-a79a-2e5a61c1ec94'::uuid
      AND company_id = 'c1cfe72f-930b-4d60-b567-242b6f0a91a8'::uuid
);


-- ========================================================
-- MIGRATION 19 OF 41: 20260720132603_18022817-0a70-4ba5-bb30-22832a4b3e45.sql
-- ========================================================

DROP FUNCTION IF EXISTS public.has_company_role(uuid, app_role, uuid);
DROP FUNCTION IF EXISTS public.has_company_role(uuid, public.app_role, uuid);
DROP FUNCTION IF EXISTS public.has_company_role;
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id uuid, _role app_role, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND company_id = _company_id
  );
$function$;


-- ========================================================
-- MIGRATION 20 OF 41: 20260801064943_d7ee9254-5879-4b2c-8761-ba74917d8b5d.sql
-- ========================================================

-- Helper: manager or above within the caller's company
CREATE OR REPLACE FUNCTION private.is_manager_or_above(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('manager','admin','super_admin')
  );
$$;

-- ============ employees: reads for company members, writes for admins only ============
DROP POLICY IF EXISTS "employees company scoped" ON public.employees;

CREATE POLICY "employees read company" ON public.employees
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE POLICY "employees admin insert" ON public.employees
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE POLICY "employees admin update" ON public.employees
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE POLICY "employees admin delete" ON public.employees
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

-- ============ user_roles: admins cannot grant or touch super_admin ============
DROP POLICY IF EXISTS "user_roles admin same company manage" ON public.user_roles;

CREATE POLICY "user_roles admin insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);

CREATE POLICY "user_roles admin update" ON public.user_roles
FOR UPDATE TO authenticated
USING (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);

CREATE POLICY "user_roles admin delete" ON public.user_roles
FOR DELETE TO authenticated
USING (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);

CREATE POLICY "user_roles admin read company" ON public.user_roles
FOR SELECT TO authenticated
USING (
  company_id IS NOT NULL
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
);

-- ============ user_role_departments: department must belong to same company ============
DROP POLICY IF EXISTS "user_role_departments admin same company manage" ON public.user_role_departments;
DROP POLICY IF EXISTS "user_role_departments admin write company" ON public.user_role_departments;

CREATE POLICY "user_role_departments admin write" ON public.user_role_departments
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (
    private.is_admin_or_super(auth.uid())
    AND company_id IS NOT NULL
    AND company_id = private.current_company_id()
  )
)
WITH CHECK (
  (
    private.is_super_admin(auth.uid())
    OR (
      private.is_admin_or_super(auth.uid())
      AND company_id IS NOT NULL
      AND company_id = private.current_company_id()
    )
  )
  AND role <> 'super_admin'::app_role
  AND EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = user_role_departments.department_id
      AND d.company_id = user_role_departments.company_id
  )
);

-- ============ project_payments: manager/admin only for writes ============
DROP POLICY IF EXISTS "project_payments company scoped" ON public.project_payments;

CREATE POLICY "project_payments read company" ON public.project_payments
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE POLICY "project_payments manager write" ON public.project_payments
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

-- ============ business tables: deletes limited to manager/admin ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','leads','projects','tasks','project_comments','task_comments',
    'lead_stage_entries','project_attachments','lead_attachments',
    'task_attachments','task_assignees'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' company scoped', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR SELECT TO authenticated
      USING (
        private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id())
      )$f$, t || ' read company', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (
        private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id())
      )$f$, t || ' insert company', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR UPDATE TO authenticated
      USING (
        private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id())
      )
      WITH CHECK (
        private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id())
      )$f$, t || ' update company', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR DELETE TO authenticated
      USING (
        private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
      )$f$, t || ' manager delete', t);
  END LOOP;
END $$;


-- ========================================================
-- MIGRATION 21 OF 41: 20260801141848_ca0e91ca-2ff5-4f55-9a1c-4599d4bf845e.sql
-- ========================================================

-- ============ Storage policies for attachment buckets ============

DROP POLICY IF EXISTS "lead attachments read" ON storage.objects;
DROP POLICY IF EXISTS "lead attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "lead attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "task attachments read" ON storage.objects;
DROP POLICY IF EXISTS "task attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "task attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "project attachments read" ON storage.objects;
DROP POLICY IF EXISTS "project attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "project attachments delete" ON storage.objects;

-- Lead attachments: path is <lead_id>/<file>
CREATE POLICY "lead attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.company_id = private.current_company_id()
  )
);

CREATE POLICY "lead attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lead-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.company_id = private.current_company_id()
  )
);

CREATE POLICY "lead attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.company_id = private.current_company_id()
  )
);

-- Task attachments: path is <uploader_uid>/<task_id>/<file>
CREATE POLICY "task attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.company_id = private.current_company_id()
  )
);

CREATE POLICY "task attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.company_id = private.current_company_id()
  )
);

CREATE POLICY "task attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_super(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.company_id = private.current_company_id()
  )
);

-- Project attachments: path is <uploader_uid>/<project_id>/<file>
CREATE POLICY "project attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_super(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.company_id = private.current_company_id()
  )
);

-- ============ Tighten user_roles admin policies to the admin's active company ============

DROP POLICY IF EXISTS "user_roles admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin delete" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin read company" ON public.user_roles;

CREATE POLICY "user_roles admin read company" ON public.user_roles FOR SELECT TO authenticated
USING (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
);

CREATE POLICY "user_roles admin insert" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);

CREATE POLICY "user_roles admin update" ON public.user_roles FOR UPDATE TO authenticated
USING (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
)
WITH CHECK (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);

CREATE POLICY "user_roles admin delete" ON public.user_roles FOR DELETE TO authenticated
USING (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);


-- ========================================================
-- MIGRATION 22 OF 41: 20260801160145_6720b374-e486-4cab-a893-f99d4d0f9d6f.sql
-- ========================================================

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_categories read company" ON public.expense_categories FOR SELECT TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE POLICY "expense_categories manager write" ON public.expense_categories FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE TRIGGER trg_expense_categories_set_company_id BEFORE INSERT ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  spent_on date NOT NULL DEFAULT (now()::date),
  category text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'cash',
  note text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_company_date ON public.expenses (company_id, spent_on DESC);
CREATE INDEX idx_expenses_project ON public.expenses (project_id);
CREATE INDEX idx_expenses_client ON public.expenses (client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses read company" ON public.expenses FOR SELECT TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE POLICY "expenses manager write" ON public.expenses FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE TRIGGER trg_expenses_set_company_id BEFORE INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ========================================================
-- MIGRATION 23 OF 41: 20260802162424_4ba439e2-59af-48fc-a46e-b5d33d169606.sql
-- ========================================================

CREATE UNIQUE INDEX IF NOT EXISTS employees_company_email_unique
  ON public.employees (company_id, lower(email))
  WHERE company_id IS NOT NULL AND coalesce(email, '') <> '';


-- ========================================================
-- MIGRATION 24 OF 41: 20260802170954_f941f8a1-2581-466f-b717-60e65e484dfb.sql
-- ========================================================

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  actor_id uuid,
  actor_email text,
  table_name text NOT NULL,
  record_id uuid,
  record_label text NOT NULL DEFAULT '',
  action text NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read their company audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.is_admin_or_super(auth.uid())
    AND company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin')
        AND ur.company_id = public.audit_log.company_id
    )
  )
);

CREATE INDEX audit_log_company_created_idx ON public.audit_log (company_id, created_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id);
CREATE INDEX audit_log_table_idx ON public.audit_log (table_name);

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_company uuid;
  v_label text;
  v_record uuid;
  v_changed jsonb := '[]'::jsonb;
  k text;
  v_action text;
  v_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_new := NULL; v_row := v_old; v_action := 'deleted';
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := to_jsonb(NEW); v_row := v_new; v_action := 'created';
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_row := v_new; v_action := 'updated';
  END IF;

  IF TG_TABLE_NAME = 'companies' THEN
    v_company := (v_row->>'id')::uuid;
  ELSE
    BEGIN
      v_company := NULLIF(v_row->>'company_id','')::uuid;
    EXCEPTION WHEN others THEN v_company := NULL;
    END;
  END IF;

  BEGIN
    v_record := NULLIF(v_row->>'id','')::uuid;
  EXCEPTION WHEN others THEN v_record := NULL;
  END;

  v_label := COALESCE(
    NULLIF(v_row->>'name',''),
    NULLIF(v_row->>'title',''),
    NULLIF(v_row->>'company_name',''),
    NULLIF(v_row->>'full_name',''),
    NULLIF(v_row->>'permission_key',''),
    NULLIF(v_row->>'role',''),
    NULLIF(v_row->>'description',''),
    ''
  );

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF k NOT IN ('updated_at') AND COALESCE(v_old->k,'null'::jsonb) IS DISTINCT FROM COALESCE(v_new->k,'null'::jsonb) THEN
        v_changed := v_changed || to_jsonb(k);
      END IF;
    END LOOP;
    IF jsonb_array_length(v_changed) = 0 THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_log(
    company_id, actor_id, actor_email, table_name, record_id, record_label,
    action, changed_fields, old_values, new_values
  ) VALUES (
    v_company, auth.uid(), v_email, TG_TABLE_NAME, v_record, v_label,
    v_action, v_changed, v_old, v_new
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_leads AFTER INSERT OR UPDATE OR DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_project_payments AFTER INSERT OR UPDATE OR DELETE ON public.project_payments FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_departments AFTER INSERT OR UPDATE OR DELETE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_audit();


-- ========================================================
-- MIGRATION 25 OF 41: 20260802171026_1eb61c72-6f15-40ad-a59e-4f497243f036.sql
-- ========================================================

REVOKE ALL ON FUNCTION public.log_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_audit() FROM anon;
REVOKE ALL ON FUNCTION public.log_audit() FROM authenticated;


-- ========================================================
-- MIGRATION 26 OF 41: 20260802171321_92034eab-2e1d-453b-a9a8-0c9b8deeccb6.sql
-- ========================================================

DROP POLICY IF EXISTS "Admins read their company audit log" ON public.audit_log;

CREATE POLICY "Admins read their company audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.company_id IS NOT NULL
      AND ur.company_id = public.audit_log.company_id
  )
);


-- ========================================================
-- MIGRATION 27 OF 41: 20260803090508_27630c01-e134-4dd3-9544-2fa3bd60e54f.sql
-- ========================================================

CREATE POLICY "employee photos read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-photos' AND (storage.foldername(name))[1] = (private.current_company_id())::text);

CREATE POLICY "employee photos insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (storage.foldername(name))[1] = (private.current_company_id())::text
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_company_role(auth.uid(), 'admin', private.current_company_id())
    OR public.has_company_role(auth.uid(), 'manager', private.current_company_id())
  )
);

CREATE POLICY "employee photos update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (storage.foldername(name))[1] = (private.current_company_id())::text
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_company_role(auth.uid(), 'admin', private.current_company_id())
    OR public.has_company_role(auth.uid(), 'manager', private.current_company_id())
  )
);

CREATE POLICY "employee photos delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (storage.foldername(name))[1] = (private.current_company_id())::text
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_company_role(auth.uid(), 'admin', private.current_company_id())
    OR public.has_company_role(auth.uid(), 'manager', private.current_company_id())
  )
);


-- ========================================================
-- MIGRATION 28 OF 41: 20260806145554_f05f0c3b-98e4-4c33-bb5e-592e9b885368.sql
-- ========================================================

DROP POLICY IF EXISTS "project attachments read" ON storage.objects;
DROP POLICY IF EXISTS "project attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "project attachments delete" ON storage.objects;

CREATE POLICY "project attachments read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(objects.name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(objects.name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(objects.name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND ((storage.foldername(objects.name))[1] = auth.uid()::text OR public.is_admin_or_super(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(objects.name))[2]
      AND p.company_id = private.current_company_id()
  )
);


-- ========================================================
-- MIGRATION 29 OF 41: 20260813124118_3c225440-de00-4d4c-89c6-dd4b1e4f44a8.sql
-- ========================================================

-- =========================================================
-- INVOICING MODULE
-- =========================================================

-- ---------- 1. invoice_settings (one row per company) ----------
CREATE TABLE public.invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_name text NOT NULL DEFAULT '',
  gstin text NOT NULL DEFAULT '',
  pan text NOT NULL DEFAULT '',
  registered_address text NOT NULL DEFAULT '',
  state_name text NOT NULL DEFAULT '',
  state_code text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bank_account_name text NOT NULL DEFAULT '',
  bank_account_no text NOT NULL DEFAULT '',
  bank_ifsc text NOT NULL DEFAULT '',
  upi_id text NOT NULL DEFAULT '',
  default_quotation_terms text NOT NULL DEFAULT '',
  default_invoice_terms text NOT NULL DEFAULT '',
  footer_note text NOT NULL DEFAULT '',
  signature_url text NOT NULL DEFAULT '',
  default_gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  quotation_validity_days integer NOT NULL DEFAULT 15,
  invoice_due_days integer NOT NULL DEFAULT 15,
  round_off_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_settings_company_unique UNIQUE (company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_settings TO authenticated;
GRANT ALL ON public.invoice_settings TO service_role;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_settings read company" ON public.invoice_settings
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_settings admin insert" ON public.invoice_settings
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_settings admin update" ON public.invoice_settings
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_settings admin delete" ON public.invoice_settings
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_settings_set_company_id
BEFORE INSERT ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoice_settings_updated_at
BEFORE UPDATE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_invoice_settings
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ---------- 2. invoice_number_series ----------
CREATE TABLE public.invoice_number_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('quotation','invoice','receipt')),
  prefix text NOT NULL DEFAULT '',
  next_number integer NOT NULL DEFAULT 1,
  padding integer NOT NULL DEFAULT 3,
  reset_yearly boolean NOT NULL DEFAULT true,
  current_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_number_series_unique UNIQUE (company_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_number_series TO authenticated;
GRANT ALL ON public.invoice_number_series TO service_role;
ALTER TABLE public.invoice_number_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_number_series read company" ON public.invoice_number_series
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_number_series admin insert" ON public.invoice_number_series
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_number_series admin update" ON public.invoice_number_series
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_number_series admin delete" ON public.invoice_number_series
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_number_series_set_company_id
BEFORE INSERT ON public.invoice_number_series
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoice_number_series_updated_at
BEFORE UPDATE ON public.invoice_number_series
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 3. tax rates & units ----------
CREATE TABLE public.invoice_tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  percent numeric(5,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_tax_rates TO authenticated;
GRANT ALL ON public.invoice_tax_rates TO service_role;
ALTER TABLE public.invoice_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_tax_rates read company" ON public.invoice_tax_rates
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_tax_rates admin write" ON public.invoice_tax_rates
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_tax_rates_set_company_id
BEFORE INSERT ON public.invoice_tax_rates
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TABLE public.invoice_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_units TO authenticated;
GRANT ALL ON public.invoice_units TO service_role;
ALTER TABLE public.invoice_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_units read company" ON public.invoice_units
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_units admin write" ON public.invoice_units
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_units_set_company_id
BEFORE INSERT ON public.invoice_units
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

-- ---------- 4. quotations ----------
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_no text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  quotation_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  place_of_supply text NOT NULL DEFAULT '',
  is_interstate boolean NOT NULL DEFAULT false,
  bill_to_name text NOT NULL DEFAULT '',
  bill_to_address text NOT NULL DEFAULT '',
  bill_to_gstin text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  cgst_total numeric(14,2) NOT NULL DEFAULT 0,
  sgst_total numeric(14,2) NOT NULL DEFAULT 0,
  igst_total numeric(14,2) NOT NULL DEFAULT 0,
  round_off numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotations read company" ON public.quotations
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotations manager insert" ON public.quotations
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotations manager update" ON public.quotations
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotations manager delete" ON public.quotations
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_quotations_set_company_id
BEFORE INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_quotations_updated_at
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_quotations
AFTER INSERT OR UPDATE OR DELETE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  hsn_sac text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 0,
  taxable_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotation_items TO service_role;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotation_items read company" ON public.quotation_items
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotation_items manager write" ON public.quotation_items
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_quotation_items_set_company_id
BEFORE INSERT ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE INDEX idx_quotation_items_quotation ON public.quotation_items(quotation_id);

-- ---------- 5. invoices ----------
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_no text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','cancelled')),
  place_of_supply text NOT NULL DEFAULT '',
  is_interstate boolean NOT NULL DEFAULT false,
  bill_to_name text NOT NULL DEFAULT '',
  bill_to_address text NOT NULL DEFAULT '',
  bill_to_gstin text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  cgst_total numeric(14,2) NOT NULL DEFAULT 0,
  sgst_total numeric(14,2) NOT NULL DEFAULT 0,
  igst_total numeric(14,2) NOT NULL DEFAULT 0,
  round_off numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices read company" ON public.invoices
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoices manager insert" ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoices manager update" ON public.invoices
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoices manager delete" ON public.invoices
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoices_set_company_id
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  hsn_sac text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 0,
  taxable_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items read company" ON public.invoice_items
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_items manager write" ON public.invoice_items
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_items_set_company_id
BEFORE INSERT ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- ---------- 6. invoice_payments ----------
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  receipt_no text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  mode text NOT NULL DEFAULT 'cash',
  reference_no text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_payments read company" ON public.invoice_payments
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_payments manager insert" ON public.invoice_payments
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_payments manager update" ON public.invoice_payments
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_payments manager delete" ON public.invoice_payments
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_payments_set_company_id
BEFORE INSERT ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoice_payments_updated_at
BEFORE UPDATE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_invoice_payments
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

-- ---------- 7. atomic document number allocator ----------
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_row public.invoice_number_series;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_num int;
  v_default_prefix text;
BEGIN
  IF _doc_type NOT IN ('quotation','invoice','receipt') THEN
    RAISE EXCEPTION 'Invalid document type %', _doc_type;
  END IF;

  v_company := private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No active company for this user';
  END IF;

  v_default_prefix := CASE _doc_type
    WHEN 'quotation' THEN 'QT-'
    WHEN 'invoice' THEN 'INV-'
    ELSE 'RCP-'
  END;

  SELECT * INTO v_row
  FROM public.invoice_number_series
  WHERE company_id = v_company AND doc_type = _doc_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.invoice_number_series(company_id, doc_type, prefix, next_number, padding, reset_yearly, current_year)
    VALUES (v_company, _doc_type, v_default_prefix, 2, 3, true, v_year)
    RETURNING * INTO v_row;
    RETURN v_row.prefix || v_year::text || '-' || lpad('1', v_row.padding, '0');
  END IF;

  IF v_row.reset_yearly AND v_row.current_year <> v_year THEN
    v_num := 1;
    UPDATE public.invoice_number_series
    SET next_number = 2, current_year = v_year, updated_at = now()
    WHERE id = v_row.id;
  ELSE
    v_num := v_row.next_number;
    UPDATE public.invoice_number_series
    SET next_number = v_row.next_number + 1, updated_at = now()
    WHERE id = v_row.id;
  END IF;

  IF v_row.reset_yearly THEN
    RETURN v_row.prefix || v_year::text || '-' || lpad(v_num::text, v_row.padding, '0');
  END IF;
  RETURN v_row.prefix || lpad(v_num::text, v_row.padding, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;

-- ---------- 8. seed defaults for existing companies ----------
INSERT INTO public.invoice_settings (company_id, legal_name)
SELECT c.id, c.name FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.invoice_number_series (company_id, doc_type, prefix)
SELECT c.id, t.doc_type, t.prefix
FROM public.companies c
CROSS JOIN (VALUES ('quotation','QT-'), ('invoice','INV-'), ('receipt','RCP-')) AS t(doc_type, prefix)
ON CONFLICT (company_id, doc_type) DO NOTHING;

INSERT INTO public.invoice_tax_rates (company_id, label, percent, sort_order)
SELECT c.id, t.label, t.percent, t.sort_order
FROM public.companies c
CROSS JOIN (VALUES ('0%',0,0), ('5%',5,1), ('12%',12,2), ('18%',18,3), ('28%',28,4)) AS t(label, percent, sort_order);

INSERT INTO public.invoice_units (company_id, name, sort_order)
SELECT c.id, u.name, u.sort_order
FROM public.companies c
CROSS JOIN (VALUES ('Nos',0), ('Hrs',1), ('Days',2), ('Kg',3), ('Sq.ft',4), ('Sq.m',5), ('Ltr',6), ('Set',7), ('Lot',8)) AS u(name, sort_order);

INSERT INTO public.company_modules (company_id, module_key, enabled)
SELECT c.id, 'invoicing', true FROM public.companies c;


-- ========================================================
-- MIGRATION 30 OF 41: 20260813143200_5cc21760-2d0d-4563-a0c5-94cde7211b9e.sql
-- ========================================================

ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS paper_size text NOT NULL DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS receipt_paper_size text NOT NULL DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS print_template text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS print_accent_color text NOT NULL DEFAULT '#1f4f82',
  ADD COLUMN IF NOT EXISTS rows_first_page integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS rows_next_page integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS repeat_table_header boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS repeat_brand_header boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_page_numbers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_continued_marker boolean NOT NULL DEFAULT true;

ALTER TABLE public.invoice_settings
  DROP CONSTRAINT IF EXISTS invoice_settings_paper_size_check,
  DROP CONSTRAINT IF EXISTS invoice_settings_receipt_paper_size_check,
  DROP CONSTRAINT IF EXISTS invoice_settings_print_template_check;

ALTER TABLE public.invoice_settings
  ADD CONSTRAINT invoice_settings_paper_size_check CHECK (paper_size IN ('A4','A5')),
  ADD CONSTRAINT invoice_settings_receipt_paper_size_check CHECK (receipt_paper_size IN ('A4','A5')),
  ADD CONSTRAINT invoice_settings_print_template_check CHECK (print_template IN ('classic','modern','compact'));


-- ========================================================
-- MIGRATION 31 OF 41: 20260902084206_40fa245e-f016-4ee5-897d-6224c2cb5b61.sql
-- ========================================================

CREATE TABLE public.expense_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expense_items_expense_id_idx ON public.expense_items(expense_id);
CREATE INDEX expense_items_company_id_idx ON public.expense_items(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_items TO authenticated;
GRANT ALL ON public.expense_items TO service_role;

ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_items read company" ON public.expense_items
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (company_id IS NOT NULL AND company_id = private.current_company_id())
  );

CREATE POLICY "expense_items manager write" ON public.expense_items
  FOR ALL TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  )
  WITH CHECK (
    private.is_super_admin(auth.uid())
    OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  );

CREATE TRIGGER trg_expense_items_set_company_id
  BEFORE INSERT ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_expense_items_updated_at
  BEFORE UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_expense_items
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

INSERT INTO public.expense_items (company_id, expense_id, description, category, quantity, rate, amount, sort_order)
SELECT e.company_id, e.id, e.title, e.category, 1, e.amount, e.amount, 0
FROM public.expenses e;


-- ========================================================
-- MIGRATION 32 OF 41: 20260903160739_5daebfb4-2e62-4a2b-978a-bbee4e4e8a92.sql
-- ========================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_date date NOT NULL DEFAULT current_date;
UPDATE public.leads SET lead_date = (created_at AT TIME ZONE 'UTC')::date WHERE lead_date IS DISTINCT FROM (created_at AT TIME ZONE 'UTC')::date;
CREATE INDEX IF NOT EXISTS leads_lead_date_idx ON public.leads (lead_date DESC);


-- ========================================================
-- MIGRATION 33 OF 41: 20260904152728_81a3b52a-0f18-4855-b5d5-9e8a66264d6b.sql
-- ========================================================

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS bill_to_contact_person text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bill_to_contact_number text NOT NULL DEFAULT '';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bill_to_contact_person text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bill_to_contact_number text NOT NULL DEFAULT '';


-- ========================================================
-- MIGRATION 34 OF 41: 20260904162927_7675675b-3cfe-4ebe-9900-e1098888bf34.sql
-- ========================================================

-- Stock & Purchase module
CREATE OR REPLACE FUNCTION private.is_executive_or_above(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('super_admin','admin','manager','executive'));
$$;
REVOKE ALL ON FUNCTION private.is_executive_or_above(uuid) FROM PUBLIC, anon;

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  gstin text NOT NULL DEFAULT '',
  opening_balance numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- STOCK MASTERS
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_locations TO authenticated;
GRANT ALL ON public.stock_locations TO service_role;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_units TO authenticated;
GRANT ALL ON public.stock_units TO service_role;
ALTER TABLE public.stock_units ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_categories TO authenticated;
GRANT ALL ON public.stock_categories TO service_role;
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'Nos',
  purchase_rate numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  po_no text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_date date NOT NULL DEFAULT current_date,
  expected_date date,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  is_interstate boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  cgst_total numeric NOT NULL DEFAULT 0,
  sgst_total numeric NOT NULL DEFAULT 0,
  igst_total numeric NOT NULL DEFAULT 0,
  round_off numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'Nos',
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 0,
  taxable_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  received_quantity numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  receipt_date date NOT NULL DEFAULT current_date,
  bill_no text NOT NULL DEFAULT '',
  bill_date date,
  notes text NOT NULL DEFAULT '',
  total_value numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipts TO authenticated;
GRANT ALL ON public.purchase_receipts TO service_role;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipt_items TO authenticated;
GRANT ALL ON public.purchase_receipt_items TO service_role;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  voucher_no text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT current_date,
  mode text NOT NULL DEFAULT 'bank',
  reference_no text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  movement_type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  reference_type text NOT NULL DEFAULT '',
  reference_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  moved_on date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  default_gst_percent numeric NOT NULL DEFAULT 18,
  default_po_terms text NOT NULL DEFAULT '',
  paper_size text NOT NULL DEFAULT 'A4',
  print_template text NOT NULL DEFAULT 'classic',
  require_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_settings TO authenticated;
GRANT ALL ON public.stock_settings TO service_role;
ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;

-- POLICIES: read for company members, write executive+ , destructive/approve/pay manager+
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'suppliers','stock_locations','stock_units','stock_categories','stock_items',
    'purchase_orders','purchase_order_items','purchase_receipts','purchase_receipt_items',
    'supplier_payments','stock_movements','stock_settings'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s read company" ON public.%1$I
      FOR SELECT TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'suppliers','stock_items','purchase_orders','purchase_order_items',
    'purchase_receipts','purchase_receipt_items','stock_movements'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s exec insert" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s exec update" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s manager delete" ON public.%1$I
      FOR DELETE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'stock_locations','stock_units','stock_categories','stock_settings','supplier_payments'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s manager insert" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s manager update" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s manager delete" ON public.%1$I
      FOR DELETE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
  END LOOP;
END $$;

-- company_id + updated_at + audit triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'suppliers','stock_locations','stock_units','stock_categories','stock_items',
    'purchase_orders','purchase_order_items','purchase_receipts','purchase_receipt_items',
    'supplier_payments','stock_movements','stock_settings'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_set_company_id BEFORE INSERT ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user()', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['suppliers','stock_items','purchase_orders','supplier_payments','stock_settings'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.log_audit()', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['purchase_receipts','stock_movements'] LOOP
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.log_audit()', t);
  END LOOP;
END $$;

CREATE INDEX suppliers_company_idx ON public.suppliers(company_id);
CREATE INDEX stock_items_company_idx ON public.stock_items(company_id);
CREATE INDEX purchase_orders_company_date_idx ON public.purchase_orders(company_id, po_date DESC);
CREATE INDEX purchase_order_items_po_idx ON public.purchase_order_items(purchase_order_id);
CREATE INDEX purchase_receipts_po_idx ON public.purchase_receipts(purchase_order_id);
CREATE INDEX purchase_receipt_items_receipt_idx ON public.purchase_receipt_items(receipt_id);
CREATE INDEX supplier_payments_supplier_idx ON public.supplier_payments(supplier_id, paid_on DESC);
CREATE INDEX stock_movements_item_idx ON public.stock_movements(company_id, item_id, moved_on DESC);

-- numbering: allow purchase docs
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_row public.invoice_number_series;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_num int;
  v_default_prefix text;
BEGIN
  IF _doc_type NOT IN ('quotation','invoice','receipt','purchase_order','purchase_payment') THEN
    RAISE EXCEPTION 'Invalid document type %', _doc_type;
  END IF;

  v_company := private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No active company for this user';
  END IF;

  v_default_prefix := CASE _doc_type
    WHEN 'quotation' THEN 'QT-'
    WHEN 'invoice' THEN 'INV-'
    WHEN 'purchase_order' THEN 'PO-'
    WHEN 'purchase_payment' THEN 'PV-'
    ELSE 'RCP-'
  END;

  SELECT * INTO v_row
  FROM public.invoice_number_series
  WHERE company_id = v_company AND doc_type = _doc_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.invoice_number_series(company_id, doc_type, prefix, next_number, padding, reset_yearly, current_year)
    VALUES (v_company, _doc_type, v_default_prefix, 2, 3, true, v_year)
    RETURNING * INTO v_row;
    RETURN v_row.prefix || v_year::text || '-' || lpad('1', v_row.padding, '0');
  END IF;

  IF v_row.reset_yearly AND v_row.current_year <> v_year THEN
    v_num := 1;
    UPDATE public.invoice_number_series
    SET next_number = 2, current_year = v_year, updated_at = now()
    WHERE id = v_row.id;
  ELSE
    v_num := v_row.next_number;
    UPDATE public.invoice_number_series
    SET next_number = v_row.next_number + 1, updated_at = now()
    WHERE id = v_row.id;
  END IF;

  IF v_row.reset_yearly THEN
    RETURN v_row.prefix || v_year::text || '-' || lpad(v_num::text, v_row.padding, '0');
  END IF;
  RETURN v_row.prefix || lpad(v_num::text, v_row.padding, '0');
END;
$function$;
REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;


-- ========================================================
-- MIGRATION 35 OF 41: 20260907091913_d46242d6-c48e-4ec1-85a2-fe6f95099c81.sql
-- ========================================================

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL;
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invoice_items_item_idx ON public.invoice_items(item_id);
CREATE INDEX IF NOT EXISTS quotation_items_item_idx ON public.quotation_items(item_id);


-- ========================================================
-- MIGRATION 36 OF 41: 20260909151747_e71e6ed3-0504-4292-8318-0fc0fb4087a4.sql
-- ========================================================

GRANT EXECUTE ON FUNCTION private.is_executive_or_above(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_manager_or_above(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION private.is_executive_or_above(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_manager_or_above(uuid) FROM PUBLIC;


-- ========================================================
-- MIGRATION 37 OF 41: 20260909161431_5d943f67-cf86-436d-9932-4d165804f119.sql
-- ========================================================

ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS require_project_on_invoice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_supplier_payments_in_accounts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_project_payments_in_income boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ledger_opening_date date;


-- ========================================================
-- MIGRATION 38 OF 41: 20260909161518_e42a7ab6-7bc9-4d41-ba58-9f2166b70359.sql
-- ========================================================

REVOKE EXECUTE ON FUNCTION public.has_company_role(uuid, app_role, uuid) FROM anon;


-- ========================================================
-- MIGRATION 39 OF 41: 20260910083233_e60d38fb-304d-4e8a-8a1c-a0d178da1060.sql
-- ========================================================

CREATE TABLE public.payment_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'cash',
  bank_name text NOT NULL DEFAULT '',
  account_no text NOT NULL DEFAULT '',
  ifsc text NOT NULL DEFAULT '',
  holder_name text NOT NULL DEFAULT '',
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_accounts_select" ON public.payment_accounts
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "payment_accounts_insert" ON public.payment_accounts
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "payment_accounts_update" ON public.payment_accounts
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()))
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "payment_accounts_delete" ON public.payment_accounts
  FOR DELETE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));

CREATE TRIGGER trg_payment_accounts_set_company_id BEFORE INSERT ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();
CREATE TRIGGER trg_payment_accounts_updated_at BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_payment_accounts AFTER INSERT OR UPDATE OR DELETE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TABLE public.account_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  transfer_date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL,
  reference_no text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;
GRANT ALL ON public.account_transfers TO service_role;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_transfers_select" ON public.account_transfers
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "account_transfers_insert" ON public.account_transfers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "account_transfers_update" ON public.account_transfers
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()))
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "account_transfers_delete" ON public.account_transfers
  FOR DELETE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));

CREATE TRIGGER trg_account_transfers_set_company_id BEFORE INSERT ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();
CREATE TRIGGER trg_account_transfers_updated_at BEFORE UPDATE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_account_transfers AFTER INSERT OR UPDATE OR DELETE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

ALTER TABLE public.invoice_payments   ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.expenses           ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_payments  ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.project_payments   ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_invoice_payments_account  ON public.invoice_payments(account_id);
CREATE INDEX idx_expenses_account          ON public.expenses(account_id);
CREATE INDEX idx_supplier_payments_account ON public.supplier_payments(account_id);
CREATE INDEX idx_project_payments_account  ON public.project_payments(account_id);
CREATE INDEX idx_account_transfers_from    ON public.account_transfers(from_account_id);
CREATE INDEX idx_account_transfers_to      ON public.account_transfers(to_account_id);


-- ========================================================
-- MIGRATION 40 OF 41: 20260912143919_7731771e-a999-4627-ac0f-856efcced7c7.sql
-- ========================================================

-- Permission-aware helper: an explicit Roles & Permissions switch wins,
-- otherwise fall back to the previous role-rank behaviour.
CREATE OR REPLACE FUNCTION private.perm_allows(_uid uuid, _key text, _fallback boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_explicit boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF public.is_admin_or_super(_uid) THEN RETURN true; END IF;

  v_company := private.current_company_id();

  SELECT bool_or(rp.allowed) INTO v_explicit
  FROM public.user_roles ur
  JOIN public.role_permissions rp
    ON rp.role = ur.role
   AND rp.permission_key = _key
  WHERE ur.user_id = _uid
    AND (ur.company_id = v_company OR ur.company_id IS NULL)
    AND rp.company_id = v_company;

  IF v_explicit IS NOT NULL THEN RETURN v_explicit; END IF;
  RETURN COALESCE(_fallback, false);
END;
$$;

REVOKE ALL ON FUNCTION private.perm_allows(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.perm_allows(uuid, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------- leads
DROP POLICY IF EXISTS "leads manager delete" ON public.leads;
CREATE POLICY "leads manage delete" ON public.leads FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.leads', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "leads insert company" ON public.leads;
CREATE POLICY "leads insert company" ON public.leads FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "leads update company" ON public.leads;
CREATE POLICY "leads update company" ON public.leads FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "lead_stage_entries manager delete" ON public.lead_stage_entries;
CREATE POLICY "lead_stage_entries manage delete" ON public.lead_stage_entries FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.leads', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "lead_stage_entries insert company" ON public.lead_stage_entries;
CREATE POLICY "lead_stage_entries insert company" ON public.lead_stage_entries FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "lead_stage_entries update company" ON public.lead_stage_entries;
CREATE POLICY "lead_stage_entries update company" ON public.lead_stage_entries FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "lead_attachments manager delete" ON public.lead_attachments;
CREATE POLICY "lead_attachments manage delete" ON public.lead_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.leads', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- clients
DROP POLICY IF EXISTS "clients manager delete" ON public.clients;
CREATE POLICY "clients manage delete" ON public.clients FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.clients', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "clients insert company" ON public.clients;
CREATE POLICY "clients insert company" ON public.clients FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.clients', true)));

DROP POLICY IF EXISTS "clients update company" ON public.clients;
CREATE POLICY "clients update company" ON public.clients FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.clients', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.clients', true)));

-- ---------------------------------------------------------------- projects
DROP POLICY IF EXISTS "projects manager delete" ON public.projects;
CREATE POLICY "projects manage delete" ON public.projects FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.projects', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "projects insert company" ON public.projects;
CREATE POLICY "projects insert company" ON public.projects FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.projects', true)));

DROP POLICY IF EXISTS "projects update company" ON public.projects;
CREATE POLICY "projects update company" ON public.projects FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.projects', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.projects', true)));

DROP POLICY IF EXISTS "project_attachments manager delete" ON public.project_attachments;
CREATE POLICY "project_attachments manage delete" ON public.project_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.projects', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "project_comments manager delete" ON public.project_comments;
CREATE POLICY "project_comments manage delete" ON public.project_comments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.projects', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "project_payments manager write" ON public.project_payments;
CREATE POLICY "project_payments manage write" ON public.project_payments FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.accounts', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.accounts', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- tasks
DROP POLICY IF EXISTS "tasks manager delete" ON public.tasks;
CREATE POLICY "tasks manage delete" ON public.tasks FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_assignees manager delete" ON public.task_assignees;
CREATE POLICY "task_assignees manage delete" ON public.task_assignees FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_attachments manager delete" ON public.task_attachments;
CREATE POLICY "task_attachments manage delete" ON public.task_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_comments manager delete" ON public.task_comments;
CREATE POLICY "task_comments manage delete" ON public.task_comments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- invoicing
DROP POLICY IF EXISTS "invoices manager delete" ON public.invoices;
CREATE POLICY "invoices manage delete" ON public.invoices FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoices manager insert" ON public.invoices;
CREATE POLICY "invoices manage insert" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoices manager update" ON public.invoices;
CREATE POLICY "invoices manage update" ON public.invoices FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "invoice_items manager write" ON public.invoice_items;
CREATE POLICY "invoice_items manage write" ON public.invoice_items FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "quotations manager delete" ON public.quotations;
CREATE POLICY "quotations manage delete" ON public.quotations FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "quotations manager insert" ON public.quotations;
CREATE POLICY "quotations manage insert" ON public.quotations FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "quotations manager update" ON public.quotations;
CREATE POLICY "quotations manage update" ON public.quotations FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "quotation_items manager write" ON public.quotation_items;
CREATE POLICY "quotation_items manage write" ON public.quotation_items FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "invoice_payments manager delete" ON public.invoice_payments;
CREATE POLICY "invoice_payments manage delete" ON public.invoice_payments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoice_payments manager insert" ON public.invoice_payments;
CREATE POLICY "invoice_payments manage insert" ON public.invoice_payments FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoice_payments manager update" ON public.invoice_payments;
CREATE POLICY "invoice_payments manage update" ON public.invoice_payments FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- expenses
DROP POLICY IF EXISTS "expenses manager write" ON public.expenses;
CREATE POLICY "expenses manage write" ON public.expenses FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "expense_items manager write" ON public.expense_items;
CREATE POLICY "expense_items manage write" ON public.expense_items FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "expense_categories manager write" ON public.expense_categories;
CREATE POLICY "expense_categories manage write" ON public.expense_categories FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- cash & bank
DROP POLICY IF EXISTS payment_accounts_delete ON public.payment_accounts;
CREATE POLICY payment_accounts_delete ON public.payment_accounts FOR DELETE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS payment_accounts_insert ON public.payment_accounts;
CREATE POLICY payment_accounts_insert ON public.payment_accounts FOR INSERT TO authenticated
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS payment_accounts_update ON public.payment_accounts;
CREATE POLICY payment_accounts_update ON public.payment_accounts FOR UPDATE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())))
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));

DROP POLICY IF EXISTS account_transfers_delete ON public.account_transfers;
CREATE POLICY account_transfers_delete ON public.account_transfers FOR DELETE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS account_transfers_insert ON public.account_transfers;
CREATE POLICY account_transfers_insert ON public.account_transfers FOR INSERT TO authenticated
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS account_transfers_update ON public.account_transfers;
CREATE POLICY account_transfers_update ON public.account_transfers FOR UPDATE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())))
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));

-- ---------------------------------------------------------------- purchase
DROP POLICY IF EXISTS "suppliers manager delete" ON public.suppliers;
CREATE POLICY "suppliers manage delete" ON public.suppliers FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "suppliers exec insert" ON public.suppliers;
CREATE POLICY "suppliers manage insert" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "suppliers exec update" ON public.suppliers;
CREATE POLICY "suppliers manage update" ON public.suppliers FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_orders manager delete" ON public.purchase_orders;
CREATE POLICY "purchase_orders manage delete" ON public.purchase_orders FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_orders exec insert" ON public.purchase_orders;
CREATE POLICY "purchase_orders manage insert" ON public.purchase_orders FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_orders exec update" ON public.purchase_orders;
CREATE POLICY "purchase_orders manage update" ON public.purchase_orders FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_order_items manager delete" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items manage delete" ON public.purchase_order_items FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_order_items exec insert" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items manage insert" ON public.purchase_order_items FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_order_items exec update" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items manage update" ON public.purchase_order_items FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_receipts manager delete" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts manage delete" ON public.purchase_receipts FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipts exec insert" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts manage insert" ON public.purchase_receipts FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipts exec update" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts manage update" ON public.purchase_receipts FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_receipt_items manager delete" ON public.purchase_receipt_items;
CREATE POLICY "purchase_receipt_items manage delete" ON public.purchase_receipt_items FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipt_items exec insert" ON public.purchase_receipt_items;
CREATE POLICY "purchase_receipt_items manage insert" ON public.purchase_receipt_items FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipt_items exec update" ON public.purchase_receipt_items;
CREATE POLICY "purchase_receipt_items manage update" ON public.purchase_receipt_items FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "supplier_payments manager delete" ON public.supplier_payments;
CREATE POLICY "supplier_payments manage delete" ON public.supplier_payments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "supplier_payments manager insert" ON public.supplier_payments;
CREATE POLICY "supplier_payments manage insert" ON public.supplier_payments FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "supplier_payments manager update" ON public.supplier_payments;
CREATE POLICY "supplier_payments manage update" ON public.supplier_payments FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- stock
DROP POLICY IF EXISTS "stock_items manager delete" ON public.stock_items;
CREATE POLICY "stock_items manage delete" ON public.stock_items FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_items exec insert" ON public.stock_items;
CREATE POLICY "stock_items manage insert" ON public.stock_items FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_items exec update" ON public.stock_items;
CREATE POLICY "stock_items manage update" ON public.stock_items FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_movements manager delete" ON public.stock_movements;
CREATE POLICY "stock_movements manage delete" ON public.stock_movements FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_movements exec insert" ON public.stock_movements;
CREATE POLICY "stock_movements manage insert" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_movements exec update" ON public.stock_movements;
CREATE POLICY "stock_movements manage update" ON public.stock_movements FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_categories manager delete" ON public.stock_categories;
CREATE POLICY "stock_categories manage delete" ON public.stock_categories FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_categories manager insert" ON public.stock_categories;
CREATE POLICY "stock_categories manage insert" ON public.stock_categories FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_categories manager update" ON public.stock_categories;
CREATE POLICY "stock_categories manage update" ON public.stock_categories FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_locations manager delete" ON public.stock_locations;
CREATE POLICY "stock_locations manage delete" ON public.stock_locations FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_locations manager insert" ON public.stock_locations;
CREATE POLICY "stock_locations manage insert" ON public.stock_locations FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_locations manager update" ON public.stock_locations;
CREATE POLICY "stock_locations manage update" ON public.stock_locations FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_units manager delete" ON public.stock_units;
CREATE POLICY "stock_units manage delete" ON public.stock_units FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_units manager insert" ON public.stock_units;
CREATE POLICY "stock_units manage insert" ON public.stock_units FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_units manager update" ON public.stock_units;
CREATE POLICY "stock_units manage update" ON public.stock_units FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_settings manager delete" ON public.stock_settings;
CREATE POLICY "stock_settings manage delete" ON public.stock_settings FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_settings manager insert" ON public.stock_settings;
CREATE POLICY "stock_settings manage insert" ON public.stock_settings FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_settings manager update" ON public.stock_settings;
CREATE POLICY "stock_settings manage update" ON public.stock_settings FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));


-- ========================================================
-- MIGRATION 41 OF 41: 20260913061323_11aa97cb-7596-41fc-a833-43501ffa1d46.sql
-- ========================================================

-- Align task delete fallback with the app's default "Manage Tasks" audience
-- (manager, executive, officer -> allowed; staff -> not allowed).
CREATE OR REPLACE FUNCTION private.can_manage_tasks_default(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_executive_or_above(_uid)
      OR public.has_company_role(_uid, 'officer'::public.app_role, private.current_company_id());
$$;

REVOKE ALL ON FUNCTION private.can_manage_tasks_default(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_manage_tasks_default(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "tasks manage delete" ON public.tasks;
CREATE POLICY "tasks manage delete" ON public.tasks FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_assignees manage delete" ON public.task_assignees;
CREATE POLICY "task_assignees manage delete" ON public.task_assignees FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_attachments manage delete" ON public.task_attachments;
CREATE POLICY "task_attachments manage delete" ON public.task_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_comments manage delete" ON public.task_comments;
CREATE POLICY "task_comments manage delete" ON public.task_comments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));


-- ========================================================
-- MIGRATION 42 OF 42: 20260918120000_qa_fixes.sql
-- ========================================================

-- 1. Workflow states: Semantic completion flag
ALTER TABLE public.workflow_states 
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false;

UPDATE public.workflow_states 
SET is_completed = true 
WHERE lower(trim(name)) IN ('done', 'complete', 'completed', 'closed');

-- 2. Stock items: Add selling_rate
ALTER TABLE public.stock_items 
  ADD COLUMN IF NOT EXISTS selling_rate NUMERIC NOT NULL DEFAULT 0;

-- 3. Profiles: Add theme_prefs
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS theme_prefs JSONB DEFAULT '{}'::jsonb;

-- 4. Document numbering: Financial year aware (April 1 - March 31) with company timezone
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_row public.invoice_number_series;
  v_tz text := 'Asia/Kolkata';
  v_local_now timestamptz;
  v_month int;
  v_year int;
  v_num int;
  v_default_prefix text;
BEGIN
  IF _doc_type NOT IN ('quotation','invoice','receipt','purchase_order','purchase_payment') THEN
    RAISE EXCEPTION 'Invalid document type %', _doc_type;
  END IF;

  v_company := private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No active company for this user';
  END IF;

  -- Read company timezone if set
  SELECT COALESCE(timezone, 'Asia/Kolkata') INTO v_tz
  FROM public.companies
  WHERE id = v_company;

  -- Local business time in company timezone
  v_local_now := now() AT TIME ZONE coalesce(v_tz, 'Asia/Kolkata');
  v_month := EXTRACT(MONTH FROM v_local_now)::int;
  
  -- Indian Financial Year: April (month 4) to March (month 3) of next calendar year.
  -- e.g. January 2026 is FY 2025, while May 2026 is FY 2026.
  IF v_month < 4 THEN
    v_year := EXTRACT(YEAR FROM v_local_now)::int - 1;
  ELSE
    v_year := EXTRACT(YEAR FROM v_local_now)::int;
  END IF;

  v_default_prefix := CASE _doc_type
    WHEN 'quotation' THEN 'QT-'
    WHEN 'invoice' THEN 'INV-'
    WHEN 'purchase_order' THEN 'PO-'
    WHEN 'purchase_payment' THEN 'PV-'
    ELSE 'RCP-'
  END;

  SELECT * INTO v_row
  FROM public.invoice_number_series
  WHERE company_id = v_company AND doc_type = _doc_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.invoice_number_series(company_id, doc_type, prefix, next_number, padding, reset_yearly, current_year)
    VALUES (v_company, _doc_type, v_default_prefix, 2, 3, true, v_year)
    RETURNING * INTO v_row;
    RETURN v_row.prefix || v_year::text || '-' || lpad('1', v_row.padding, '0');
  END IF;

  IF v_row.reset_yearly AND v_row.current_year <> v_year THEN
    v_num := 1;
    UPDATE public.invoice_number_series
    SET next_number = 2, current_year = v_year, updated_at = now()
    WHERE id = v_row.id;
  ELSE
    v_num := v_row.next_number;
    UPDATE public.invoice_number_series
    SET next_number = v_row.next_number + 1, updated_at = now()
    WHERE id = v_row.id;
  END IF;

  RETURN v_row.prefix || v_year::text || '-' || lpad(v_num::text, v_row.padding, '0');
END;
$function$;

-- =========================================================================
-- 20260918161000_inventory_categories.sql
-- =========================================================================
ALTER TABLE public.stock_categories 
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS stock_categories_company_lower_name_idx 
  ON public.stock_categories (company_id, lower(trim(name)));

ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.stock_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stock_items_category_id_idx ON public.stock_items(category_id);
CREATE INDEX IF NOT EXISTS stock_categories_company_idx ON public.stock_categories(company_id);

UPDATE public.stock_items i
SET category_id = c.id
FROM public.stock_categories c
WHERE i.company_id = c.company_id 
  AND lower(trim(i.category)) = lower(trim(c.name))
  AND i.category_id IS NULL;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_stock_categories_updated_at ON public.stock_categories;
  CREATE TRIGGER trg_stock_categories_updated_at 
    BEFORE UPDATE ON public.stock_categories 
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "stock_categories exec insert" ON public.stock_categories;
CREATE POLICY "stock_categories exec insert" ON public.stock_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin(auth.uid())
    OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  );

DROP POLICY IF EXISTS "stock_categories exec update" ON public.stock_categories;
CREATE POLICY "stock_categories exec update" ON public.stock_categories
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  )
  WITH CHECK (
    private.is_super_admin(auth.uid())
    OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  );
