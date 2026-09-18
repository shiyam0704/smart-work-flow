ALTER TABLE public.tasks                  DROP COLUMN IF EXISTS task_type_id;
ALTER TABLE public.project_template_tasks DROP COLUMN IF EXISTS task_type_id;
DROP TABLE  IF EXISTS public.task_types CASCADE;