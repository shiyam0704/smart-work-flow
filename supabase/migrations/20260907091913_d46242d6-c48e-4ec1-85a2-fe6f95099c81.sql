ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL;
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invoice_items_item_idx ON public.invoice_items(item_id);
CREATE INDEX IF NOT EXISTS quotation_items_item_idx ON public.quotation_items(item_id);