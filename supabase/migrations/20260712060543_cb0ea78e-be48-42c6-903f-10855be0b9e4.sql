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