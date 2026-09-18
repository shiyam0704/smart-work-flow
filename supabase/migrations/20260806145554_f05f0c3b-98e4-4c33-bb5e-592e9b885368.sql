DROP POLICY IF EXISTS "project attachments read" ON storage.objects;
DROP POLICY IF EXISTS "project attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "project attachments delete" ON storage.objects;

CREATE POLICY "project attachments read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(objects.name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(objects.name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(objects.name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND ((storage.foldername(objects.name))[1] = auth.uid()::text OR public.is_admin_or_super(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(objects.name))[2]
      AND p.company_id = private.current_company_id()
  )
);