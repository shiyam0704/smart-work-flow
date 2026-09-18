CREATE POLICY "companies admin update own"
ON public.companies
FOR UPDATE
TO authenticated
USING (id = private.current_company_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = private.current_company_id() AND public.has_role(auth.uid(), 'admin'));