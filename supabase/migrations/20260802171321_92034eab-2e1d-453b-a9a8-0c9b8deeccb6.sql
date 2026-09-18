DROP POLICY IF EXISTS "Admins read their company audit log" ON public.audit_log;

CREATE POLICY "Admins read their company audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.company_id IS NOT NULL
      AND ur.company_id = public.audit_log.company_id
  )
);