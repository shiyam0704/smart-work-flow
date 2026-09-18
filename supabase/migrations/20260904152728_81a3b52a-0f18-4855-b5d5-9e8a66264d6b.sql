ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS bill_to_contact_person text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bill_to_contact_number text NOT NULL DEFAULT '';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bill_to_contact_person text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bill_to_contact_number text NOT NULL DEFAULT '';