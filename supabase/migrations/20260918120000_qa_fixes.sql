-- Migration: 20260918120000_qa_fixes.sql
-- Description: QA fixes for workflow completion semantics, stock selling rates, theme preferences, and financial year document numbering.

-- 1. Workflow states: Semantic completion flag
ALTER TABLE public.workflow_states 
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false;

UPDATE public.workflow_states 
SET is_completed = true 
WHERE lower(trim(name)) IN ('done', 'complete', 'completed', 'closed');

-- 2. Stock items: Add selling_rate
ALTER TABLE public.stock_items 
  ADD COLUMN IF NOT EXISTS selling_rate NUMERIC NOT NULL DEFAULT 0;

-- 3. Profiles: Add theme_prefs
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS theme_prefs JSONB DEFAULT '{}'::jsonb;

-- 4. Document numbering: Financial year aware (April 1 - March 31) with company timezone
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_row public.invoice_number_series;
  v_tz text := 'Asia/Kolkata';
  v_local_now timestamptz;
  v_month int;
  v_year int;
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

  -- Read company timezone if set
  SELECT COALESCE(timezone, 'Asia/Kolkata') INTO v_tz
  FROM public.companies
  WHERE id = v_company;

  -- Local business time in company timezone
  v_local_now := now() AT TIME ZONE coalesce(v_tz, 'Asia/Kolkata');
  v_month := EXTRACT(MONTH FROM v_local_now)::int;
  
  -- Indian Financial Year: April (month 4) to March (month 3) of next calendar year.
  -- e.g. January 2026 is FY 2025, while May 2026 is FY 2026.
  IF v_month < 4 THEN
    v_year := EXTRACT(YEAR FROM v_local_now)::int - 1;
  ELSE
    v_year := EXTRACT(YEAR FROM v_local_now)::int;
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

  RETURN v_row.prefix || v_year::text || '-' || lpad(v_num::text, v_row.padding, '0');
END;
$function$;
