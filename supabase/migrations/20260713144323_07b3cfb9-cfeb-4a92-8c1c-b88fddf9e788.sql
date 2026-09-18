
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
