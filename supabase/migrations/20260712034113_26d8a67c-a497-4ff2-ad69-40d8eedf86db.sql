
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
