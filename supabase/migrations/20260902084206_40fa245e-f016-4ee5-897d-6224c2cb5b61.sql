CREATE TABLE public.expense_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expense_items_expense_id_idx ON public.expense_items(expense_id);
CREATE INDEX expense_items_company_id_idx ON public.expense_items(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_items TO authenticated;
GRANT ALL ON public.expense_items TO service_role;

ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_items read company" ON public.expense_items
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (company_id IS NOT NULL AND company_id = private.current_company_id())
  );

CREATE POLICY "expense_items manager write" ON public.expense_items
  FOR ALL TO authenticated
  USING (
    private.is_super_admin(auth.uid())
    OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  )
  WITH CHECK (
    private.is_super_admin(auth.uid())
    OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
  );

CREATE TRIGGER trg_expense_items_set_company_id
  BEFORE INSERT ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_expense_items_updated_at
  BEFORE UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_expense_items
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

INSERT INTO public.expense_items (company_id, expense_id, description, category, quantity, rate, amount, sort_order)
SELECT e.company_id, e.id, e.title, e.category, 1, e.amount, e.amount, 0
FROM public.expenses e;