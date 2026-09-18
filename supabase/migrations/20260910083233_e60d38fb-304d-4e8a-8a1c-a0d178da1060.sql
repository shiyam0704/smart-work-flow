CREATE TABLE public.payment_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'cash',
  bank_name text NOT NULL DEFAULT '',
  account_no text NOT NULL DEFAULT '',
  ifsc text NOT NULL DEFAULT '',
  holder_name text NOT NULL DEFAULT '',
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_accounts_select" ON public.payment_accounts
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "payment_accounts_insert" ON public.payment_accounts
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "payment_accounts_update" ON public.payment_accounts
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()))
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "payment_accounts_delete" ON public.payment_accounts
  FOR DELETE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));

CREATE TRIGGER trg_payment_accounts_set_company_id BEFORE INSERT ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();
CREATE TRIGGER trg_payment_accounts_updated_at BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_payment_accounts AFTER INSERT OR UPDATE OR DELETE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TABLE public.account_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  transfer_date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL,
  reference_no text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;
GRANT ALL ON public.account_transfers TO service_role;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_transfers_select" ON public.account_transfers
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "account_transfers_insert" ON public.account_transfers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "account_transfers_update" ON public.account_transfers
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()))
  WITH CHECK (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));
CREATE POLICY "account_transfers_delete" ON public.account_transfers
  FOR DELETE TO authenticated
  USING (company_id = private.current_company_id() AND private.is_manager_or_above(auth.uid()));

CREATE TRIGGER trg_account_transfers_set_company_id BEFORE INSERT ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();
CREATE TRIGGER trg_account_transfers_updated_at BEFORE UPDATE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_account_transfers AFTER INSERT OR UPDATE OR DELETE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

ALTER TABLE public.invoice_payments   ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.expenses           ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_payments  ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.project_payments   ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_invoice_payments_account  ON public.invoice_payments(account_id);
CREATE INDEX idx_expenses_account          ON public.expenses(account_id);
CREATE INDEX idx_supplier_payments_account ON public.supplier_payments(account_id);
CREATE INDEX idx_project_payments_account  ON public.project_payments(account_id);
CREATE INDEX idx_account_transfers_from    ON public.account_transfers(from_account_id);
CREATE INDEX idx_account_transfers_to      ON public.account_transfers(to_account_id);