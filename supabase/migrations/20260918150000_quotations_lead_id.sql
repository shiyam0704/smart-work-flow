-- Migration: 20260918150000_quotations_lead_id.sql
-- Description: Add lead_id to quotations table with company isolation and indexing

-- 1. Add lead_id foreign key column to public.quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- 2. Index lead_id for efficient lookup of quotations by originating lead
CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON public.quotations(lead_id);

-- 3. Trigger to enforce company isolation: quotation.company_id must match lead.company_id
CREATE OR REPLACE FUNCTION public.check_quotation_lead_company_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lead_company uuid;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT company_id INTO v_lead_company
    FROM public.leads
    WHERE id = NEW.lead_id;

    IF v_lead_company IS NOT NULL AND NEW.company_id IS NOT NULL AND v_lead_company <> NEW.company_id THEN
      RAISE EXCEPTION 'Quotation company_id (%) does not match originating Lead company_id (%)',
        NEW.company_id, v_lead_company;
    END IF;

    -- If quotation company_id is null, inherit from lead
    IF NEW.company_id IS NULL AND v_lead_company IS NOT NULL THEN
      NEW.company_id := v_lead_company;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_lead_company_match ON public.quotations;
CREATE TRIGGER trg_quotation_lead_company_match
BEFORE INSERT OR UPDATE OF lead_id, company_id ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.check_quotation_lead_company_match();
