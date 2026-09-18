ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_date date NOT NULL DEFAULT current_date;
UPDATE public.leads SET lead_date = (created_at AT TIME ZONE 'UTC')::date WHERE lead_date IS DISTINCT FROM (created_at AT TIME ZONE 'UTC')::date;
CREATE INDEX IF NOT EXISTS leads_lead_date_idx ON public.leads (lead_date DESC);