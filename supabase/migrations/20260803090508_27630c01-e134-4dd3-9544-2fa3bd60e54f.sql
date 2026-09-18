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