CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_categories read company" ON public.expense_categories FOR SELECT TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE POLICY "expense_categories manager write" ON public.expense_categories FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE TRIGGER trg_expense_categories_set_company_id BEFORE INSERT ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  spent_on date NOT NULL DEFAULT (now()::date),
  category text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'cash',
  note text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_company_date ON public.expenses (company_id, spent_on DESC);
CREATE INDEX idx_expenses_project ON public.expenses (project_id);
CREATE INDEX idx_expenses_client ON public.expenses (client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses read company" ON public.expenses FOR SELECT TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE POLICY "expenses manager write" ON public.expenses FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
CREATE TRIGGER trg_expenses_set_company_id BEFORE INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();