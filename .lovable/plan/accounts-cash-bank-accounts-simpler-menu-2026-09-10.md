# Accounts: cash & bank accounts, simpler menu

## Menu changes

```text
Accounts        Income
                Expenses
                Accounts     (cash / bank accounts — new)

Invoicing       Quotations
                Invoices
                Pending      (customer dues, unchanged)

Purchase        Purchase Orders
                Suppliers
                Supplier Pending  (unchanged)
```

- Ledger is removed from Accounts (it only repeated Income and Expenses).
- Accounts → Pending is removed; customer dues stay in Invoicing → Pending and
  supplier dues in Purchase → Supplier Pending.
- Old links to the removed pages redirect: Ledger and Pending send you to
  Invoicing → Pending / Purchase → Supplier Pending respectively, so bookmarks
  keep working.

## The new Accounts page

A list of the places money actually sits — for example Cash Box, HDFC Current
A/c, Petty Cash, a UPI wallet. Each account has:

- Name, type (Cash, Bank, UPI/Wallet, Other)
- Bank details for bank accounts (bank name, account number, IFSC, holder)
- Opening balance and opening date
- Active / inactive
- Notes

The page shows one card or row per account with opening balance, money in,
money out and the current balance, plus a total across all accounts. Clicking an
account opens its statement: every entry that touched it, in date order, with a
running balance and CSV export.

Money can also move between accounts: a **Transfer** entry (from account, to
account, date, amount, reference, note) reduces one balance and increases the
other, and is never counted as income or expense anywhere else in the app.

## Choosing the account on every money entry

Every place money is recorded gains an **Account** picker:

- Invoice receipts (Record Payment)
- Expenses (including each multi-line expense entry — one account per expense)
- Supplier payments
- Older project receipts

The picker defaults to the last used account and is required for new entries
once at least one account exists. Existing records stay untouched and are shown
as "Unassigned" in the Accounts view, so nothing breaks and old data can be
tagged later by editing the entry.

Income and Expenses pages gain an Account column and an Account filter.

## Permissions

Roles & Permissions gets:

- View Accounts Book — see accounts and their balances
- Manage Accounts Book — add/edit accounts, record transfers

Default: Manager on, others off, Admin always. The old View Ledger and View
Pending Summary permissions are dropped from the list; existing saved settings
for other permissions are untouched.

## Settings

Settings → Invoicing keeps its money options; the ledger opening date field is
replaced by per-account opening balance and date, and the field is removed from
that screen (the stored value is left in place, unused).

## Technical notes

- Migration: new `payment_accounts` table (name, account_type, bank_name,
  account_no, ifsc, holder_name, opening_balance, opening_date, is_active,
  notes, company_id) and `account_transfers` (from_account_id, to_account_id,
  transfer_date, amount, reference_no, note). Both with company-scoped RLS,
  GRANTs to authenticated/service_role, updated_at triggers and audit triggers,
  matching the existing supplier/expense tables.
- Nullable `account_id` column added to `invoice_payments`, `expenses`,
  `supplier_payments`, `project_payments`, each referencing
  `payment_accounts(id)`; nullable keeps every existing row valid.
- New `use-payment-accounts.ts` hook (CRUD + transfers) following
  `use-suppliers.ts` conventions.
- `use-money-flow.ts` extended: each row carries `accountId`/`accountName`;
  transfers are exposed as a separate stream used only by the accounts
  statement, excluded from income and outgoing.
- Routes: add `accounts.book` (list) and `accounts.book.$accountId`
  (statement); convert `accounts.ledger` and `accounts.pending` into redirects;
  `accounts.index` redirects to `accounts/income`.
- Account picker added to `RecordPaymentDialog`, `EditExpenseModal`,
  `SupplierPaymentDialog`, `PaymentsCard`.
- `PERMISSIONS`/`PERMISSION_MENUS`: add `nav.accounts.book`,
  `manage.accounts.book`; remove `nav.accounts.ledger`,
  `nav.accounts.pending`.
- Tab strip in `c.$slug._app.accounts.tsx`, Sidebar and BottomNav child arrays
  updated.
