-- Permission-aware helper: an explicit Roles & Permissions switch wins,
-- otherwise fall back to the previous role-rank behaviour.
CREATE OR REPLACE FUNCTION private.perm_allows(_uid uuid, _key text, _fallback boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_explicit boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF public.is_admin_or_super(_uid) THEN RETURN true; END IF;

  v_company := private.current_company_id();

  SELECT bool_or(rp.allowed) INTO v_explicit
  FROM public.user_roles ur
  JOIN public.role_permissions rp
    ON rp.role = ur.role
   AND rp.permission_key = _key
  WHERE ur.user_id = _uid
    AND (ur.company_id = v_company OR ur.company_id IS NULL)
    AND rp.company_id = v_company;

  IF v_explicit IS NOT NULL THEN RETURN v_explicit; END IF;
  RETURN COALESCE(_fallback, false);
END;
$$;

REVOKE ALL ON FUNCTION private.perm_allows(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.perm_allows(uuid, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------- leads
DROP POLICY IF EXISTS "leads manager delete" ON public.leads;
CREATE POLICY "leads manage delete" ON public.leads FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.leads', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "leads insert company" ON public.leads;
CREATE POLICY "leads insert company" ON public.leads FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "leads update company" ON public.leads;
CREATE POLICY "leads update company" ON public.leads FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "lead_stage_entries manager delete" ON public.lead_stage_entries;
CREATE POLICY "lead_stage_entries manage delete" ON public.lead_stage_entries FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.leads', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "lead_stage_entries insert company" ON public.lead_stage_entries;
CREATE POLICY "lead_stage_entries insert company" ON public.lead_stage_entries FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "lead_stage_entries update company" ON public.lead_stage_entries;
CREATE POLICY "lead_stage_entries update company" ON public.lead_stage_entries FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.leads', true)));

DROP POLICY IF EXISTS "lead_attachments manager delete" ON public.lead_attachments;
CREATE POLICY "lead_attachments manage delete" ON public.lead_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.leads', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- clients
DROP POLICY IF EXISTS "clients manager delete" ON public.clients;
CREATE POLICY "clients manage delete" ON public.clients FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.clients', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "clients insert company" ON public.clients;
CREATE POLICY "clients insert company" ON public.clients FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.clients', true)));

DROP POLICY IF EXISTS "clients update company" ON public.clients;
CREATE POLICY "clients update company" ON public.clients FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.clients', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.clients', true)));

-- ---------------------------------------------------------------- projects
DROP POLICY IF EXISTS "projects manager delete" ON public.projects;
CREATE POLICY "projects manage delete" ON public.projects FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.projects', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "projects insert company" ON public.projects;
CREATE POLICY "projects insert company" ON public.projects FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.projects', true)));

DROP POLICY IF EXISTS "projects update company" ON public.projects;
CREATE POLICY "projects update company" ON public.projects FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.projects', true)))
WITH CHECK (private.is_super_admin(auth.uid()) OR (company_id IS NOT NULL AND company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.projects', true)));

DROP POLICY IF EXISTS "project_attachments manager delete" ON public.project_attachments;
CREATE POLICY "project_attachments manage delete" ON public.project_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.projects', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "project_comments manager delete" ON public.project_comments;
CREATE POLICY "project_comments manage delete" ON public.project_comments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.projects', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "project_payments manager write" ON public.project_payments;
CREATE POLICY "project_payments manage write" ON public.project_payments FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.accounts', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.accounts', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- tasks
DROP POLICY IF EXISTS "tasks manager delete" ON public.tasks;
CREATE POLICY "tasks manage delete" ON public.tasks FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_assignees manager delete" ON public.task_assignees;
CREATE POLICY "task_assignees manage delete" ON public.task_assignees FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_attachments manager delete" ON public.task_attachments;
CREATE POLICY "task_attachments manage delete" ON public.task_attachments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "task_comments manager delete" ON public.task_comments;
CREATE POLICY "task_comments manage delete" ON public.task_comments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.tasks', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- invoicing
DROP POLICY IF EXISTS "invoices manager delete" ON public.invoices;
CREATE POLICY "invoices manage delete" ON public.invoices FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoices manager insert" ON public.invoices;
CREATE POLICY "invoices manage insert" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoices manager update" ON public.invoices;
CREATE POLICY "invoices manage update" ON public.invoices FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "invoice_items manager write" ON public.invoice_items;
CREATE POLICY "invoice_items manage write" ON public.invoice_items FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "quotations manager delete" ON public.quotations;
CREATE POLICY "quotations manage delete" ON public.quotations FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "quotations manager insert" ON public.quotations;
CREATE POLICY "quotations manage insert" ON public.quotations FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "quotations manager update" ON public.quotations;
CREATE POLICY "quotations manage update" ON public.quotations FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "quotation_items manager write" ON public.quotation_items;
CREATE POLICY "quotation_items manage write" ON public.quotation_items FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "invoice_payments manager delete" ON public.invoice_payments;
CREATE POLICY "invoice_payments manage delete" ON public.invoice_payments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoice_payments manager insert" ON public.invoice_payments;
CREATE POLICY "invoice_payments manage insert" ON public.invoice_payments FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "invoice_payments manager update" ON public.invoice_payments;
CREATE POLICY "invoice_payments manage update" ON public.invoice_payments FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.invoicing', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- expenses
DROP POLICY IF EXISTS "expenses manager write" ON public.expenses;
CREATE POLICY "expenses manage write" ON public.expenses FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "expense_items manager write" ON public.expense_items;
CREATE POLICY "expense_items manage write" ON public.expense_items FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "expense_categories manager write" ON public.expense_categories;
CREATE POLICY "expense_categories manage write" ON public.expense_categories FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.expenses', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- cash & bank
DROP POLICY IF EXISTS payment_accounts_delete ON public.payment_accounts;
CREATE POLICY payment_accounts_delete ON public.payment_accounts FOR DELETE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS payment_accounts_insert ON public.payment_accounts;
CREATE POLICY payment_accounts_insert ON public.payment_accounts FOR INSERT TO authenticated
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS payment_accounts_update ON public.payment_accounts;
CREATE POLICY payment_accounts_update ON public.payment_accounts FOR UPDATE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())))
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));

DROP POLICY IF EXISTS account_transfers_delete ON public.account_transfers;
CREATE POLICY account_transfers_delete ON public.account_transfers FOR DELETE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS account_transfers_insert ON public.account_transfers;
CREATE POLICY account_transfers_insert ON public.account_transfers FOR INSERT TO authenticated
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));
DROP POLICY IF EXISTS account_transfers_update ON public.account_transfers;
CREATE POLICY account_transfers_update ON public.account_transfers FOR UPDATE TO authenticated
USING (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())))
WITH CHECK (company_id = private.current_company_id() AND private.perm_allows(auth.uid(),'manage.accounts.book', private.is_manager_or_above(auth.uid())));

-- ---------------------------------------------------------------- purchase
DROP POLICY IF EXISTS "suppliers manager delete" ON public.suppliers;
CREATE POLICY "suppliers manage delete" ON public.suppliers FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "suppliers exec insert" ON public.suppliers;
CREATE POLICY "suppliers manage insert" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "suppliers exec update" ON public.suppliers;
CREATE POLICY "suppliers manage update" ON public.suppliers FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_orders manager delete" ON public.purchase_orders;
CREATE POLICY "purchase_orders manage delete" ON public.purchase_orders FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_orders exec insert" ON public.purchase_orders;
CREATE POLICY "purchase_orders manage insert" ON public.purchase_orders FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_orders exec update" ON public.purchase_orders;
CREATE POLICY "purchase_orders manage update" ON public.purchase_orders FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_order_items manager delete" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items manage delete" ON public.purchase_order_items FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_order_items exec insert" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items manage insert" ON public.purchase_order_items FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_order_items exec update" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items manage update" ON public.purchase_order_items FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_receipts manager delete" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts manage delete" ON public.purchase_receipts FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipts exec insert" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts manage insert" ON public.purchase_receipts FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipts exec update" ON public.purchase_receipts;
CREATE POLICY "purchase_receipts manage update" ON public.purchase_receipts FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "purchase_receipt_items manager delete" ON public.purchase_receipt_items;
CREATE POLICY "purchase_receipt_items manage delete" ON public.purchase_receipt_items FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipt_items exec insert" ON public.purchase_receipt_items;
CREATE POLICY "purchase_receipt_items manage insert" ON public.purchase_receipt_items FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "purchase_receipt_items exec update" ON public.purchase_receipt_items;
CREATE POLICY "purchase_receipt_items manage update" ON public.purchase_receipt_items FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "supplier_payments manager delete" ON public.supplier_payments;
CREATE POLICY "supplier_payments manage delete" ON public.supplier_payments FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "supplier_payments manager insert" ON public.supplier_payments;
CREATE POLICY "supplier_payments manage insert" ON public.supplier_payments FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "supplier_payments manager update" ON public.supplier_payments;
CREATE POLICY "supplier_payments manage update" ON public.supplier_payments FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.purchase', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

-- ---------------------------------------------------------------- stock
DROP POLICY IF EXISTS "stock_items manager delete" ON public.stock_items;
CREATE POLICY "stock_items manage delete" ON public.stock_items FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_items exec insert" ON public.stock_items;
CREATE POLICY "stock_items manage insert" ON public.stock_items FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_items exec update" ON public.stock_items;
CREATE POLICY "stock_items manage update" ON public.stock_items FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_movements manager delete" ON public.stock_movements;
CREATE POLICY "stock_movements manage delete" ON public.stock_movements FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_movements exec insert" ON public.stock_movements;
CREATE POLICY "stock_movements manage insert" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_movements exec update" ON public.stock_movements;
CREATE POLICY "stock_movements manage update" ON public.stock_movements FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_executive_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_categories manager delete" ON public.stock_categories;
CREATE POLICY "stock_categories manage delete" ON public.stock_categories FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_categories manager insert" ON public.stock_categories;
CREATE POLICY "stock_categories manage insert" ON public.stock_categories FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_categories manager update" ON public.stock_categories;
CREATE POLICY "stock_categories manage update" ON public.stock_categories FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_locations manager delete" ON public.stock_locations;
CREATE POLICY "stock_locations manage delete" ON public.stock_locations FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_locations manager insert" ON public.stock_locations;
CREATE POLICY "stock_locations manage insert" ON public.stock_locations FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_locations manager update" ON public.stock_locations;
CREATE POLICY "stock_locations manage update" ON public.stock_locations FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_units manager delete" ON public.stock_units;
CREATE POLICY "stock_units manage delete" ON public.stock_units FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_units manager insert" ON public.stock_units;
CREATE POLICY "stock_units manage insert" ON public.stock_units FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_units manager update" ON public.stock_units;
CREATE POLICY "stock_units manage update" ON public.stock_units FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'manage.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));

DROP POLICY IF EXISTS "stock_settings manager delete" ON public.stock_settings;
CREATE POLICY "stock_settings manage delete" ON public.stock_settings FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_settings manager insert" ON public.stock_settings;
CREATE POLICY "stock_settings manage insert" ON public.stock_settings FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));
DROP POLICY IF EXISTS "stock_settings manager update" ON public.stock_settings;
CREATE POLICY "stock_settings manage update" ON public.stock_settings FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()))
WITH CHECK (private.is_super_admin(auth.uid()) OR (private.perm_allows(auth.uid(),'settings.stock', private.is_manager_or_above(auth.uid())) AND company_id IS NOT NULL AND company_id = private.current_company_id()));