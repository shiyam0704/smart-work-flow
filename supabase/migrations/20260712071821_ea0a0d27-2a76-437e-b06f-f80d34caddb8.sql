
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
