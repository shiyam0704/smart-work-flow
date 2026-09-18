-- ============ Storage policies for attachment buckets ============

DROP POLICY IF EXISTS "lead attachments read" ON storage.objects;
DROP POLICY IF EXISTS "lead attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "lead attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "task attachments read" ON storage.objects;
DROP POLICY IF EXISTS "task attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "task attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "project attachments read" ON storage.objects;
DROP POLICY IF EXISTS "project attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "project attachments delete" ON storage.objects;

-- Lead attachments: path is <lead_id>/<file>
CREATE POLICY "lead attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.company_id = private.current_company_id()
  )
);

CREATE POLICY "lead attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lead-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.company_id = private.current_company_id()
  )
);

CREATE POLICY "lead attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lead-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.company_id = private.current_company_id()
  )
);

-- Task attachments: path is <uploader_uid>/<task_id>/<file>
CREATE POLICY "task attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.company_id = private.current_company_id()
  )
);

CREATE POLICY "task attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.company_id = private.current_company_id()
  )
);

CREATE POLICY "task attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_super(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.company_id = private.current_company_id()
  )
);

-- Project attachments: path is <uploader_uid>/<project_id>/<file>
CREATE POLICY "project attachments read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.company_id = private.current_company_id()
  )
);

CREATE POLICY "project attachments delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_super(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.company_id = private.current_company_id()
  )
);

-- ============ Tighten user_roles admin policies to the admin's active company ============

DROP POLICY IF EXISTS "user_roles admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin delete" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin read company" ON public.user_roles;

CREATE POLICY "user_roles admin read company" ON public.user_roles FOR SELECT TO authenticated
USING (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
);

CREATE POLICY "user_roles admin insert" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);

CREATE POLICY "user_roles admin update" ON public.user_roles FOR UPDATE TO authenticated
USING (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
)
WITH CHECK (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);

CREATE POLICY "user_roles admin delete" ON public.user_roles FOR DELETE TO authenticated
USING (
  company_id IS NOT NULL
  AND company_id = private.current_company_id()
  AND public.has_company_role(auth.uid(), 'admin'::app_role, company_id)
  AND role <> 'super_admin'::app_role
);