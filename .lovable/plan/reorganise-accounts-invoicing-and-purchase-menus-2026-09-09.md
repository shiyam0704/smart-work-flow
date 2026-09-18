# Reorganise Accounts, Invoicing and Purchase menus

Your grouping is correct and clearer than the current one. Here is what it becomes.

## New menu structure

```text
Accounts        Income      (money received)
                Expenses    (expenses + supplier payments)
                Ledger      (money in and out, running balance)
                Pending     (summary: customer dues + supplier dues)

Invoicing       Quotations
                Invoices
                Pending     (unpaid / part-paid invoices)

Purchase        Purchase Orders
                Suppliers
                Supplier Pending  (what we owe each supplier)
```

## Accounts

**Income** — every receipt in one list: invoice receipts and the older project
receipts, with a "Source" column showing which one, plus the client, project,
date, mode and amount. Filters for date range, client and source; CSV export.

**Expenses** — the existing expense list, with supplier payments included and
marked as such, so total outgoing money is honest. Adding/editing still creates
normal expense records only; supplier payments stay editable in Purchase.

**Ledger** — one combined statement: each row is money in or money out, sorted
by date, with a running balance and totals for received, spent and net. Date
range, type (in/out) and text filters; CSV export.

**Pending** — a summary of what is owed: outstanding customer amounts (from
invoices and from projects billed without an invoice) and outstanding supplier
amounts, each with a total and a link into the detailed list under Invoicing or
Purchase. The current project-based pending table stays here as the customer
section.

## Invoicing

Quotations and Invoices stay as they are. The Payments tab is replaced by
**Pending**: invoices that are unpaid or part-paid, with invoiced amount,
received, balance and days overdue; filters for client and date; CSV export.
Recording a receipt stays on the invoice itself (same dialog as today), and all
receipts are viewable in Accounts → Income.

## Purchase

Purchase Orders and Suppliers stay. The Payments tab becomes **Supplier
Pending**: one row per supplier with billed, paid and balance, expandable to the
orders and payments behind it. Recording a supplier payment stays available here
and in the supplier's page, and every payment appears in Accounts → Expenses and
Ledger.

## Linking an invoice to a project — optional, never forced

The project field on a quotation / invoice stays optional exactly as today: you
can link it to a project, or leave it blank for a standalone or walk-in sale.
What changes is visibility, not the rule:

- Project name shown as a column in the invoice list, invoice Pending and Income.
- A filter to see only linked, only unlinked, or all documents.
- A project's page gets an "Invoicing" section listing its quotations, invoices
  and receipts.

Nothing existing is disturbed: no record is edited, moved or deleted, and every
current page keeps working. Old links — Accounts → Pending Details, Invoicing →
Payments, Purchase → Payments — redirect to their new homes so bookmarks stay
valid.

## Permissions

Roles & Permissions gets a row for each new page so access can be tuned:

- Accounts: View Income, View Ledger, View Pending, plus the existing View /
  Manage Expenses and Manage Accounts.
- Invoicing: existing View / Manage, plus View Pending.
- Purchase: existing View / Manage, plus View Supplier Pending.

Sensible defaults: Manager sees everything in these menus; Executive sees
Invoicing and Purchase documents but not the money views unless switched on;
Officer and Staff off. Admin always full. Existing saved settings are kept.

## Settings

Settings → Invoicing gains a small "Accounts & linking" block:

- Require a project on every invoice — off by default, keeping it optional.
- Include supplier payments in Accounts expenses and ledger — on by default.
- Include project payments (older records) in Income — on by default.
- Opening balance date for the ledger, so the running balance can start from a
  chosen date.

## Technical notes

- Route files: add `accounts.income`, `accounts.pending` (rewritten as summary),
  `invoicing.pending`, `purchase.pending`; keep `accounts.ledger`; convert
  `invoicing.payments` and `purchase.payments` into redirects.
- New read-only hooks compose existing ones: income = `use-invoice-payments` +
  `use-project-payments`; outgoing = `use-expenses` + `use-supplier-payments`;
  ledger merges both streams client-side. Receivables reuse `use-invoices` +
  `use-invoice-payments` and the current project/final-price logic; payables
  reuse `useSupplierBalances`.
- Tab strips in `c.$slug._app.accounts.tsx`, `.invoicing.tsx`, `.purchase.tsx`
  and the sidebar/bottom-nav child arrays updated to the new labels.
- New permission keys `accounts.income`, `accounts.ledger`, `accounts.pending`,
  `invoicing.pending`, `purchase.pending` added to `PERMISSIONS` and to the
  matching `PERMISSION_MENUS` entries; existing `nav.*` / `manage.*` keys and
  saved `role_permissions` rows unchanged.
- New settings columns on `invoice_settings`: `require_project_on_invoice`,
  `include_supplier_payments_in_accounts`, `include_project_payments_in_income`,
  `ledger_opening_date` — all with defaults matching today's behaviour, so one
  additive migration and no data change.
- Project detail page gains an invoicing section querying invoices/quotations by
  `project_id`.
