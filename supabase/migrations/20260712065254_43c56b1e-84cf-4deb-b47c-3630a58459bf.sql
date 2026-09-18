
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
