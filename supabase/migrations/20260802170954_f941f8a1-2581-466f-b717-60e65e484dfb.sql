CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  actor_id uuid,
  actor_email text,
  table_name text NOT NULL,
  record_id uuid,
  record_label text NOT NULL DEFAULT '',
  action text NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read their company audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.is_admin_or_super(auth.uid())
    AND company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin')
        AND ur.company_id = public.audit_log.company_id
    )
  )
);

CREATE INDEX audit_log_company_created_idx ON public.audit_log (company_id, created_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id);
CREATE INDEX audit_log_table_idx ON public.audit_log (table_name);

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_company uuid;
  v_label text;
  v_record uuid;
  v_changed jsonb := '[]'::jsonb;
  k text;
  v_action text;
  v_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_new := NULL; v_row := v_old; v_action := 'deleted';
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := to_jsonb(NEW); v_row := v_new; v_action := 'created';
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_row := v_new; v_action := 'updated';
  END IF;

  IF TG_TABLE_NAME = 'companies' THEN
    v_company := (v_row->>'id')::uuid;
  ELSE
    BEGIN
      v_company := NULLIF(v_row->>'company_id','')::uuid;
    EXCEPTION WHEN others THEN v_company := NULL;
    END;
  END IF;

  BEGIN
    v_record := NULLIF(v_row->>'id','')::uuid;
  EXCEPTION WHEN others THEN v_record := NULL;
  END;

  v_label := COALESCE(
    NULLIF(v_row->>'name',''),
    NULLIF(v_row->>'title',''),
    NULLIF(v_row->>'company_name',''),
    NULLIF(v_row->>'full_name',''),
    NULLIF(v_row->>'permission_key',''),
    NULLIF(v_row->>'role',''),
    NULLIF(v_row->>'description',''),
    ''
  );

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF k NOT IN ('updated_at') AND COALESCE(v_old->k,'null'::jsonb) IS DISTINCT FROM COALESCE(v_new->k,'null'::jsonb) THEN
        v_changed := v_changed || to_jsonb(k);
      END IF;
    END LOOP;
    IF jsonb_array_length(v_changed) = 0 THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_log(
    company_id, actor_id, actor_email, table_name, record_id, record_label,
    action, changed_fields, old_values, new_values
  ) VALUES (
    v_company, auth.uid(), v_email, TG_TABLE_NAME, v_record, v_label,
    v_action, v_changed, v_old, v_new
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_leads AFTER INSERT OR UPDATE OR DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_project_payments AFTER INSERT OR UPDATE OR DELETE ON public.project_payments FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_departments AFTER INSERT OR UPDATE OR DELETE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_audit();