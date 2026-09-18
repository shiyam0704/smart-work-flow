ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS paper_size text NOT NULL DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS receipt_paper_size text NOT NULL DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS print_template text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS print_accent_color text NOT NULL DEFAULT '#1f4f82',
  ADD COLUMN IF NOT EXISTS rows_first_page integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS rows_next_page integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS repeat_table_header boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS repeat_brand_header boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_page_numbers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_continued_marker boolean NOT NULL DEFAULT true;

ALTER TABLE public.invoice_settings
  DROP CONSTRAINT IF EXISTS invoice_settings_paper_size_check,
  DROP CONSTRAINT IF EXISTS invoice_settings_receipt_paper_size_check,
  DROP CONSTRAINT IF EXISTS invoice_settings_print_template_check;

ALTER TABLE public.invoice_settings
  ADD CONSTRAINT invoice_settings_paper_size_check CHECK (paper_size IN ('A4','A5')),
  ADD CONSTRAINT invoice_settings_receipt_paper_size_check CHECK (receipt_paper_size IN ('A4','A5')),
  ADD CONSTRAINT invoice_settings_print_template_check CHECK (print_template IN ('classic','modern','compact'));