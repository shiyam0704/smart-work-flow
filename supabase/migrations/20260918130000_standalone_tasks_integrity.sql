-- Migration: 20260918130000_standalone_tasks_integrity.sql
-- Description: Ensures task project relationships are explicit and company-scoped. Standalone tasks have project_id = NULL.

-- 1. Ensure project_id has no DEFAULT value (standalone tasks must have NULL)
DO $$
BEGIN
  ALTER TABLE public.tasks ALTER COLUMN project_id DROP DEFAULT;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Validate multi-tenant company match if a task is linked to a project
CREATE OR REPLACE FUNCTION public.check_task_project_company_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_proj_company uuid;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT company_id INTO v_proj_company
    FROM public.projects
    WHERE id = NEW.project_id;

    IF v_proj_company IS NOT NULL AND NEW.company_id IS NOT NULL AND v_proj_company <> NEW.company_id THEN
      RAISE EXCEPTION 'Project % does not belong to company %', NEW.project_id, NEW.company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_task_project_company_match ON public.tasks;
CREATE TRIGGER trg_task_project_company_match
BEFORE INSERT OR UPDATE OF project_id, company_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.check_task_project_company_match();
