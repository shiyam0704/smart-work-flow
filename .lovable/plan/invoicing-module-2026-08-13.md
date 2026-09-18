# Invoicing Module

A full quotation → invoice → payment flow, GST-ready, branded per company, with print/PDF output and its own settings section.

## What you get

### 1. Quotations
- Quotation list under a new **Invoicing** area with tabs: Quotations, Invoices, Payments.
- Create/edit quotation: client (required), optional project, quotation date, valid-until date, line items, notes, terms.
- Line items: description, HSN/SAC, unit, qty, rate, discount %, GST %.
- Status: Draft, Sent, Accepted, Rejected, Expired.
- Actions: duplicate, print/PDF view, and **Convert to Invoice** (copies all lines, links back to the quotation).

### 2. Invoices
- Create directly or from a quotation. Fields: client, optional project, invoice date, due date, place of supply, line items, notes/terms.
- GST handling: per-line GST %, auto-split into CGST+SGST when the client's state matches the company state, IGST when it differs. Totals show subtotal, discount, each tax head, round-off and grand total.
- Status derived from payments: Draft, Sent, Partly Paid, Paid, Overdue, Cancelled.
- Shows amount paid and balance due on the invoice and in the list.

### 3. Payment entry + payment slip
- Record payments against an invoice: amount, date, mode (cash / bank / UPI / card / cheque / other), reference no., note.
- Validation prevents over-payment beyond the invoice balance.
- Each payment has a **payment receipt/slip** print view with company branding, invoice reference, amount in words, and balance after payment.
- Payments tab lists all payments with client/invoice filters, date range and CSV export.

### 4. Print / PDF / image output
- Branded print views for quotation, invoice and payment slip: company logo, name, GSTIN, address, bank details, signature/stamp, terms.
- Print-optimised A4 layout — the browser's print dialog saves as PDF, and the view can be screenshotted as an image. No new dependency.

### 5. Settings → Invoicing
New settings page with four groups:
- **Number series** — separate prefix, next number, padding and yearly-reset toggle for quotations, invoices and receipts. Numbers are allocated safely so two users can't get the same number.
- **Company tax & legal details** — GSTIN, PAN, registered address, state (drives GST split), bank name, account no., IFSC, UPI ID.
- **Terms, notes & signature** — default terms and footer notes pre-filled on new documents, plus an uploaded signature/stamp image.
- **Tax rates & units** — reusable GST % presets (0/5/12/18/28 seeded) and unit list (Nos, Hrs, Kg, Sq.ft, etc.) used in the line-item pickers.

### 6. Integrations
- Client detail page: quotations/invoices for that client with outstanding total.
- Project detail page: linked quotations/invoices.
- Accounts → Ledger and Pending Details include invoice payments alongside existing project payments.
- Dashboard finance section gains invoiced / collected / outstanding, gated by the finance permission.

## Access control
- New permissions: view quotations, view invoices, create/edit invoices, record payments, delete invoices, manage invoicing settings — with sensible role defaults (manager and above by default, admin always).
- New `invoicing` module toggle so a company can switch the whole area off.

## Technical notes
- Tables (all company-scoped, RLS + GRANTs, audit triggers, updated_at triggers): `invoice_settings`, `invoice_number_series`, `invoice_tax_rates`, `invoice_units`, `quotations`, `quotation_items`, `invoices`, `invoice_items`, `invoice_payments`.
- Amounts stored as `numeric(14,2)`; per-line and per-document tax totals persisted so historical documents never change if settings change later.
- Number allocation via a `SECURITY DEFINER` SQL function that increments the series row atomically, scoped to the caller's company.
- Signature/stamp uploads reuse the existing private `company-logos` bucket pattern with company-folder RLS.
- Routes: `src/routes/c.$slug._app.invoicing.*` (layout + quotations/invoices/payments tabs and detail pages) and `c.$slug._app.settings.invoicing.tsx`; print views are separate routes rendered with a print-only layout.
- Hooks follow the existing `useSharedResource` + realtime + cache-invalidate pattern (`use-quotations`, `use-invoices`, `use-invoice-payments`, `use-invoice-settings`).
- Sidebar/BottomNav gain an Invoicing entry; Settings index gains the Invoicing card in order after Company.

## Build order
1. Database migration (tables, RLS, grants, triggers, number function, seed tax rates/units).
2. Hooks + shared calculation helper (GST split, totals, amount-in-words).
3. Settings → Invoicing page.
4. Quotations list, editor, detail, print view.
5. Invoices list, editor, detail, print view, convert-from-quotation.
6. Payments entry, list, payment slip print view.
7. Permissions, navigation, module toggle, and Accounts/Dashboard/Client/Project integrations.
