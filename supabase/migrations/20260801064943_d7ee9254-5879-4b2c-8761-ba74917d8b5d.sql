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