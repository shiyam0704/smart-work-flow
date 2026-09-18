
-- Allow admins/super_admins of a company to manage objects in company-logos/{company_id}/*
CREATE POLICY "company-logos admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "company-logos admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "company-logos admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Admins/super_admins may also list/read their own company's logo objects
-- (public rendering goes through /api/public/c/{slug}/logo, not direct storage access).
CREATE POLICY "company-logos admin select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.company_id::text = (storage.foldername(name))[1]
    )
  )
);
