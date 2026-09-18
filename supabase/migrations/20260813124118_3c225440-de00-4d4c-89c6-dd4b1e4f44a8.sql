-- =========================================================
-- INVOICING MODULE
-- =========================================================

-- ---------- 1. invoice_settings (one row per company) ----------
CREATE TABLE public.invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_name text NOT NULL DEFAULT '',
  gstin text NOT NULL DEFAULT '',
  pan text NOT NULL DEFAULT '',
  registered_address text NOT NULL DEFAULT '',
  state_name text NOT NULL DEFAULT '',
  state_code text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bank_account_name text NOT NULL DEFAULT '',
  bank_account_no text NOT NULL DEFAULT '',
  bank_ifsc text NOT NULL DEFAULT '',
  upi_id text NOT NULL DEFAULT '',
  default_quotation_terms text NOT NULL DEFAULT '',
  default_invoice_terms text NOT NULL DEFAULT '',
  footer_note text NOT NULL DEFAULT '',
  signature_url text NOT NULL DEFAULT '',
  default_gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  quotation_validity_days integer NOT NULL DEFAULT 15,
  invoice_due_days integer NOT NULL DEFAULT 15,
  round_off_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_settings_company_unique UNIQUE (company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_settings TO authenticated;
GRANT ALL ON public.invoice_settings TO service_role;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_settings read company" ON public.invoice_settings
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_settings admin insert" ON public.invoice_settings
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_settings admin update" ON public.invoice_settings
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_settings admin delete" ON public.invoice_settings
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_settings_set_company_id
BEFORE INSERT ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoice_settings_updated_at
BEFORE UPDATE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_invoice_settings
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ---------- 2. invoice_number_series ----------
CREATE TABLE public.invoice_number_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('quotation','invoice','receipt')),
  prefix text NOT NULL DEFAULT '',
  next_number integer NOT NULL DEFAULT 1,
  padding integer NOT NULL DEFAULT 3,
  reset_yearly boolean NOT NULL DEFAULT true,
  current_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_number_series_unique UNIQUE (company_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_number_series TO authenticated;
GRANT ALL ON public.invoice_number_series TO service_role;
ALTER TABLE public.invoice_number_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_number_series read company" ON public.invoice_number_series
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_number_series admin insert" ON public.invoice_number_series
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_number_series admin update" ON public.invoice_number_series
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_number_series admin delete" ON public.invoice_number_series
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_number_series_set_company_id
BEFORE INSERT ON public.invoice_number_series
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoice_number_series_updated_at
BEFORE UPDATE ON public.invoice_number_series
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 3. tax rates & units ----------
CREATE TABLE public.invoice_tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  percent numeric(5,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_tax_rates TO authenticated;
GRANT ALL ON public.invoice_tax_rates TO service_role;
ALTER TABLE public.invoice_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_tax_rates read company" ON public.invoice_tax_rates
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_tax_rates admin write" ON public.invoice_tax_rates
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_tax_rates_set_company_id
BEFORE INSERT ON public.invoice_tax_rates
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TABLE public.invoice_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_units TO authenticated;
GRANT ALL ON public.invoice_units TO service_role;
ALTER TABLE public.invoice_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_units read company" ON public.invoice_units
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_units admin write" ON public.invoice_units
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_admin_or_super(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_units_set_company_id
BEFORE INSERT ON public.invoice_units
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

-- ---------- 4. quotations ----------
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_no text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  quotation_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  place_of_supply text NOT NULL DEFAULT '',
  is_interstate boolean NOT NULL DEFAULT false,
  bill_to_name text NOT NULL DEFAULT '',
  bill_to_address text NOT NULL DEFAULT '',
  bill_to_gstin text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  cgst_total numeric(14,2) NOT NULL DEFAULT 0,
  sgst_total numeric(14,2) NOT NULL DEFAULT 0,
  igst_total numeric(14,2) NOT NULL DEFAULT 0,
  round_off numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotations read company" ON public.quotations
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotations manager insert" ON public.quotations
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotations manager update" ON public.quotations
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotations manager delete" ON public.quotations
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_quotations_set_company_id
BEFORE INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_quotations_updated_at
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_quotations
AFTER INSERT OR UPDATE OR DELETE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  hsn_sac text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 0,
  taxable_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotation_items TO service_role;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotation_items read company" ON public.quotation_items
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "quotation_items manager write" ON public.quotation_items
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_quotation_items_set_company_id
BEFORE INSERT ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE INDEX idx_quotation_items_quotation ON public.quotation_items(quotation_id);

-- ---------- 5. invoices ----------
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_no text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','cancelled')),
  place_of_supply text NOT NULL DEFAULT '',
  is_interstate boolean NOT NULL DEFAULT false,
  bill_to_name text NOT NULL DEFAULT '',
  bill_to_address text NOT NULL DEFAULT '',
  bill_to_gstin text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  cgst_total numeric(14,2) NOT NULL DEFAULT 0,
  sgst_total numeric(14,2) NOT NULL DEFAULT 0,
  igst_total numeric(14,2) NOT NULL DEFAULT 0,
  round_off numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices read company" ON public.invoices
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoices manager insert" ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoices manager update" ON public.invoices
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoices manager delete" ON public.invoices
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoices_set_company_id
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  hsn_sac text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 0,
  taxable_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items read company" ON public.invoice_items
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_items manager write" ON public.invoice_items
FOR ALL TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_items_set_company_id
BEFORE INSERT ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- ---------- 6. invoice_payments ----------
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  receipt_no text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  mode text NOT NULL DEFAULT 'cash',
  reference_no text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_payments read company" ON public.invoice_payments
FOR SELECT TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_payments manager insert" ON public.invoice_payments
FOR INSERT TO authenticated
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_payments manager update" ON public.invoice_payments
FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);
CREATE POLICY "invoice_payments manager delete" ON public.invoice_payments
FOR DELETE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id())
);

CREATE TRIGGER trg_invoice_payments_set_company_id
BEFORE INSERT ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user();

CREATE TRIGGER trg_invoice_payments_updated_at
BEFORE UPDATE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_invoice_payments
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

-- ---------- 7. atomic document number allocator ----------
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_row public.invoice_number_series;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_num int;
  v_default_prefix text;
BEGIN
  IF _doc_type NOT IN ('quotation','invoice','receipt') THEN
    RAISE EXCEPTION 'Invalid document type %', _doc_type;
  END IF;

  v_company := private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No active company for this user';
  END IF;

  v_default_prefix := CASE _doc_type
    WHEN 'quotation' THEN 'QT-'
    WHEN 'invoice' THEN 'INV-'
    ELSE 'RCP-'
  END;

  SELECT * INTO v_row
  FROM public.invoice_number_series
  WHERE company_id = v_company AND doc_type = _doc_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.invoice_number_series(company_id, doc_type, prefix, next_number, padding, reset_yearly, current_year)
    VALUES (v_company, _doc_type, v_default_prefix, 2, 3, true, v_year)
    RETURNING * INTO v_row;
    RETURN v_row.prefix || v_year::text || '-' || lpad('1', v_row.padding, '0');
  END IF;

  IF v_row.reset_yearly AND v_row.current_year <> v_year THEN
    v_num := 1;
    UPDATE public.invoice_number_series
    SET next_number = 2, current_year = v_year, updated_at = now()
    WHERE id = v_row.id;
  ELSE
    v_num := v_row.next_number;
    UPDATE public.invoice_number_series
    SET next_number = v_row.next_number + 1, updated_at = now()
    WHERE id = v_row.id;
  END IF;

  IF v_row.reset_yearly THEN
    RETURN v_row.prefix || v_year::text || '-' || lpad(v_num::text, v_row.padding, '0');
  END IF;
  RETURN v_row.prefix || lpad(v_num::text, v_row.padding, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;

-- ---------- 8. seed defaults for existing companies ----------
INSERT INTO public.invoice_settings (company_id, legal_name)
SELECT c.id, c.name FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.invoice_number_series (company_id, doc_type, prefix)
SELECT c.id, t.doc_type, t.prefix
FROM public.companies c
CROSS JOIN (VALUES ('quotation','QT-'), ('invoice','INV-'), ('receipt','RCP-')) AS t(doc_type, prefix)
ON CONFLICT (company_id, doc_type) DO NOTHING;

INSERT INTO public.invoice_tax_rates (company_id, label, percent, sort_order)
SELECT c.id, t.label, t.percent, t.sort_order
FROM public.companies c
CROSS JOIN (VALUES ('0%',0,0), ('5%',5,1), ('12%',12,2), ('18%',18,3), ('28%',28,4)) AS t(label, percent, sort_order);

INSERT INTO public.invoice_units (company_id, name, sort_order)
SELECT c.id, u.name, u.sort_order
FROM public.companies c
CROSS JOIN (VALUES ('Nos',0), ('Hrs',1), ('Days',2), ('Kg',3), ('Sq.ft',4), ('Sq.m',5), ('Ltr',6), ('Set',7), ('Lot',8)) AS u(name, sort_order);

INSERT INTO public.company_modules (company_id, module_key, enabled)
SELECT c.id, 'invoicing', true FROM public.companies c;