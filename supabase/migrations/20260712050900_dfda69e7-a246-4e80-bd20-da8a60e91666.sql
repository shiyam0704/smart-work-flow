
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
