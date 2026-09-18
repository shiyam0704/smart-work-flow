# Add a Lead Date to leads

Right now a lead only has the automatic "created" timestamp, so when someone enters a lead a day or two late, or updates a follow-up date, there is no field holding the actual date the lead came in. This adds an explicit **Lead date** you control.

## What you get

- **New Lead form**: a "Lead date" field, pre-filled with today, editable (e.g. back-date a lead entered late).
- **Edit Lead form**: the same field, so a wrong date can be corrected.
- **Lead list / cards**: shows the lead date instead of the created/updated timestamp, and list sorting by date uses the lead date.
- **Date range filters** on the Leads page (Today / This month / Custom range) filter on the lead date, so the pipeline numbers match the real lead dates.
- **CSV export** gains a "Lead date" column.
- **Existing leads** keep working: their lead date is set from their created date, so nothing looks empty.

## Technical notes

- Migration: add `lead_date date not null default current_date` to `public.leads`, backfill existing rows from `created_at`, and index it for the date-range queries. No policy changes needed (existing company-scoped RLS covers the new column).
- `src/hooks/use-leads.ts`: add `lead_date` to `LeadRow` and `NewLeadInput`, default to today's local date on create, and order the fetch by `lead_date desc, created_at desc`.
- `NewLeadModal.tsx` / `EditLeadModal.tsx`: add a `type="date"` input next to Lead source; default `new Date()` formatted as `yyyy-MM-dd` in local time.
- `src/routes/c.$slug._app.leads.index.tsx`: switch the `inRange(l.created_at, ...)` filter to `l.lead_date`.
- `LeadsListView.tsx` and `LeadCard.tsx`: display `lead_date`; the date sort key uses `lead_date`.
- `src/lib/leads-csv.ts`: add the `lead_date` column (keep the existing Created column).
- Calendar view keeps using the follow-up date — unchanged.
