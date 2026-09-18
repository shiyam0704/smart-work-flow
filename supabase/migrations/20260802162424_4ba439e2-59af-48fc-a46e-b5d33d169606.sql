CREATE UNIQUE INDEX IF NOT EXISTS employees_company_email_unique
  ON public.employees (company_id, lower(email))
  WHERE company_id IS NOT NULL AND coalesce(email, '') <> '';