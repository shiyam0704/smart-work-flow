ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS require_project_on_invoice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_supplier_payments_in_accounts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_project_payments_in_income boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ledger_opening_date date;