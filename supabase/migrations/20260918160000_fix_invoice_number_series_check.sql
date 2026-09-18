-- Migration: 20260918160000_fix_invoice_number_series_check.sql
-- Description: Expand invoice_number_series doc_type check constraint to allow purchase_order and purchase_payment

ALTER TABLE public.invoice_number_series
  DROP CONSTRAINT IF EXISTS invoice_number_series_doc_type_check;

ALTER TABLE public.invoice_number_series
  ADD CONSTRAINT invoice_number_series_doc_type_check
  CHECK (doc_type IN ('quotation', 'invoice', 'receipt', 'purchase_order', 'purchase_payment'));
