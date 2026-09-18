-- Migration: 20260918140000_default_workflow_states.sql
-- Description: Ensure baseline workflow states exist and add task default status trigger

-- 1. Insert default workflow states if none exist
INSERT INTO public.workflow_states (name, color, sort_order, is_completed)
SELECT d.name, d.color, d.sort_order, d.is_completed
FROM (VALUES
  ('To Do', 'var(--neon-cyan)', 0, false),
  ('In Progress', 'var(--neon-purple)', 1, false),
  ('Completed', 'var(--neon-green)', 2, true)
) AS d(name, color, sort_order, is_completed)
WHERE NOT EXISTS (SELECT 1 FROM public.workflow_states);

-- 2. Trigger function to ensure tasks always have an active workflow state on creation
CREATE OR REPLACE FUNCTION public.set_task_default_workflow_state()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_default_status uuid;
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT id INTO v_default_status
    FROM public.workflow_states
    WHERE is_completed = false
    ORDER BY sort_order ASC
    LIMIT 1;

    IF v_default_status IS NULL THEN
      SELECT id INTO v_default_status
      FROM public.workflow_states
      ORDER BY sort_order ASC
      LIMIT 1;
    END IF;

    NEW.status_id := v_default_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_default_workflow_state ON public.tasks;
CREATE TRIGGER trg_set_task_default_workflow_state
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_default_workflow_state();
