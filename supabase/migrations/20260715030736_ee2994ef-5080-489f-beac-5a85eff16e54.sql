
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
