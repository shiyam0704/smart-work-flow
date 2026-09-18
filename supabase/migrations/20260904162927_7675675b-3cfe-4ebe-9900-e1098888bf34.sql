-- Stock & Purchase module
CREATE OR REPLACE FUNCTION private.is_executive_or_above(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('super_admin','admin','manager','executive'));
$$;
REVOKE ALL ON FUNCTION private.is_executive_or_above(uuid) FROM PUBLIC, anon;

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  gstin text NOT NULL DEFAULT '',
  opening_balance numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- STOCK MASTERS
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_locations TO authenticated;
GRANT ALL ON public.stock_locations TO service_role;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_units TO authenticated;
GRANT ALL ON public.stock_units TO service_role;
ALTER TABLE public.stock_units ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_categories TO authenticated;
GRANT ALL ON public.stock_categories TO service_role;
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'Nos',
  purchase_rate numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  po_no text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_date date NOT NULL DEFAULT current_date,
  expected_date date,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  is_interstate boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  cgst_total numeric NOT NULL DEFAULT 0,
  sgst_total numeric NOT NULL DEFAULT 0,
  igst_total numeric NOT NULL DEFAULT 0,
  round_off numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'Nos',
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 0,
  taxable_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  received_quantity numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  receipt_date date NOT NULL DEFAULT current_date,
  bill_no text NOT NULL DEFAULT '',
  bill_date date,
  notes text NOT NULL DEFAULT '',
  total_value numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipts TO authenticated;
GRANT ALL ON public.purchase_receipts TO service_role;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipt_items TO authenticated;
GRANT ALL ON public.purchase_receipt_items TO service_role;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  voucher_no text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT current_date,
  mode text NOT NULL DEFAULT 'bank',
  reference_no text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  movement_type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  reference_type text NOT NULL DEFAULT '',
  reference_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  moved_on date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  default_gst_percent numeric NOT NULL DEFAULT 18,
  default_po_terms text NOT NULL DEFAULT '',
  paper_size text NOT NULL DEFAULT 'A4',
  print_template text NOT NULL DEFAULT 'classic',
  require_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_settings TO authenticated;
GRANT ALL ON public.stock_settings TO service_role;
ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;

-- POLICIES: read for company members, write executive+ , destructive/approve/pay manager+
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'suppliers','stock_locations','stock_units','stock_categories','stock_items',
    'purchase_orders','purchase_order_items','purchase_receipts','purchase_receipt_items',
    'supplier_payments','stock_movements','stock_settings'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s read company" ON public.%1$I
      FOR SELECT TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'suppliers','stock_items','purchase_orders','purchase_order_items',
    'purchase_receipts','purchase_receipt_items','stock_movements'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s exec insert" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s exec update" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_executive_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s manager delete" ON public.%1$I
      FOR DELETE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'stock_locations','stock_units','stock_categories','stock_settings','supplier_payments'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s manager insert" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s manager update" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
      WITH CHECK (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s manager delete" ON public.%1$I
      FOR DELETE TO authenticated
      USING (private.is_super_admin(auth.uid())
        OR (private.is_manager_or_above(auth.uid()) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
    $f$, t);
  END LOOP;
END $$;

-- company_id + updated_at + audit triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'suppliers','stock_locations','stock_units','stock_categories','stock_items',
    'purchase_orders','purchase_order_items','purchase_receipts','purchase_receipt_items',
    'supplier_payments','stock_movements','stock_settings'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_set_company_id BEFORE INSERT ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.set_company_id_from_user()', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['suppliers','stock_items','purchase_orders','supplier_payments','stock_settings'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.log_audit()', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['purchase_receipts','stock_movements'] LOOP
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.log_audit()', t);
  END LOOP;
END $$;

CREATE INDEX suppliers_company_idx ON public.suppliers(company_id);
CREATE INDEX stock_items_company_idx ON public.stock_items(company_id);
CREATE INDEX purchase_orders_company_date_idx ON public.purchase_orders(company_id, po_date DESC);
CREATE INDEX purchase_order_items_po_idx ON public.purchase_order_items(purchase_order_id);
CREATE INDEX purchase_receipts_po_idx ON public.purchase_receipts(purchase_order_id);
CREATE INDEX purchase_receipt_items_receipt_idx ON public.purchase_receipt_items(receipt_id);
CREATE INDEX supplier_payments_supplier_idx ON public.supplier_payments(supplier_id, paid_on DESC);
CREATE INDEX stock_movements_item_idx ON public.stock_movements(company_id, item_id, moved_on DESC);

-- numbering: allow purchase docs
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_row public.invoice_number_series;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_num int;
  v_default_prefix text;
BEGIN
  IF _doc_type NOT IN ('quotation','invoice','receipt','purchase_order','purchase_payment') THEN
    RAISE EXCEPTION 'Invalid document type %', _doc_type;
  END IF;

  v_company := private.current_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No active company for this user';
  END IF;

  v_default_prefix := CASE _doc_type
    WHEN 'quotation' THEN 'QT-'
    WHEN 'invoice' THEN 'INV-'
    WHEN 'purchase_order' THEN 'PO-'
    WHEN 'purchase_payment' THEN 'PV-'
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
$function$;
REVOKE ALL ON FUNCTION public.next_document_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO authenticated;