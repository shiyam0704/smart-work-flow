-- Align task delete fallback with the app's default "Manage Tasks" audience
-- (manager, executive, officer -> allowed; staff -> not allowed).
CREATE OR REPLACE FUNCTION private.can_manage_tasks_default(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_executive_or_above(_uid)
      OR public.has_company_role(_uid, 'officer'::public.app_role, private.current_company_id());
$$;

REVOKE ALL ON FUNCTION private.can_manage_tasks_default(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_manage_tasks_default(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "tasks manage delete" ON public.tasks;
CREATE POLICY "tasks manage delete" ON public.tasks FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_assignees manage delete" ON public.task_assignees;
CREATE POLICY "task_assignees manage delete" ON public.task_assignees FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_attachments manage delete" ON public.task_attachments;
CREATE POLICY "task_attachments manage delete" ON public.task_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_comments manage delete" ON public.task_comments;
CREATE POLICY "task_comments manage delete" ON public.task_comments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.can_manage_tasks_default(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));