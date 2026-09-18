# Stock & Purchase module

A new area of the app for buying materials and tracking what you have in store, with its own menus and its own settings page.

## Menus

Two new main menu entries (sidebar + mobile "More"), each with sub-menus, shown only to people whose role allows them:

- **Purchase**
  - Suppliers
  - Purchase Orders
  - Payments
- **Stock**
  - Items
  - Stock Balance
  - Movements (in / out / transfer / adjust)

Settings gets a new **Stock & Purchase** page.

## Suppliers

Own supplier list (separate from clients): name, contact person, phone, email, address, city, GST number, opening balance, notes, active/inactive. Full add / edit / delete with search.

## Supplier balance & payments

- A **Payments** sub-menu under Purchase to record what you pay each supplier: amount, date, mode, reference no., note, and optionally tagged to a purchase order/bill. A payment voucher number is generated automatically and can be printed.
- Supplier detail page shows: total purchased, total paid, **outstanding balance**, plus a full statement — every bill/receipt and every payment in date order with a running balance.
- Suppliers list shows outstanding balance per supplier with a total, sortable, and a filter for "has outstanding".
- Purchase order/bill view shows paid and balance amounts, same as invoices do.
- CSV export of the supplier statement and the outstanding summary.


## Items

Item master: name, code, category, unit (from settings), purchase rate, minimum stock level, notes, active flag. Items are the things you purchase and hold in stock.

## Purchase Orders

- PO number generated automatically using the same numbering approach already used for quotations and invoices (prefix + year + running number, configurable in settings).
- Header: supplier, PO date, expected date, destination store, notes, terms.
- Lines: item, quantity, rate, discount %, GST %, computed taxable / tax / line total; totals shown like the quotation form.
- Statuses: Draft -> Pending approval -> Approved -> Ordered -> Partially received -> Received -> Cancelled.
- **Approval step:** only manager and above can approve; a PO cannot be received until approved.
- Printable PO using the existing print/branding setup, honouring the paper size and template chosen in settings.

## Receiving (stock in)

From an approved PO, a "Receive" screen lets you enter received quantity per line (allowing part receipts), the store it goes into, and a supplier bill number/date. Receiving creates stock-in movements and moves the PO to Partially received / Received automatically.

## Stock

- **Multiple stores/locations** per company, managed in settings.
- Stock balance view: per item per store, with total, value, and a low-stock highlight when below minimum level.
- Movement types: In (purchase receipt), Out (issued to a project or task), Transfer (store to store), Adjust (correction with reason).
- **Issue to project/task:** an Issue screen picks a project (optional task), store, and items with quantities; stock reduces and the movement records who issued it and to which project/task. Invoices do not touch stock.
- Movement history with filters by date range, item, store, type, project.
- CSV export on suppliers, purchase orders, stock balance, and movements.

## Settings -> Stock & Purchase

- Stores/locations list (add, rename, activate/deactivate).
- Units list (Nos, Kg, Litre, Box...).
- Item categories list.
- PO numbering: prefix, padding, yearly reset.
- Default GST %, default terms for POs.
- Print paper size (A4/A5) and template for the PO.
- Toggle whether approval is required (on by default) and who counts as approver (manager and above).

## Dashboard & reports

- Dashboard tiles (only for people with access): purchase value in the selected date range, supplier outstanding, pending POs awaiting approval, low-stock item count, stock value.
- A Reports sub-page for purchases (by supplier, by item), supplier outstanding, and stock movement summary.

## Technical notes

- Migration adds, all company-scoped with `company_id`, the standard `set_company_id_from_user` trigger, `updated_at` trigger, audit triggers, GRANTs, RLS enabled, and company-scoped policies matching the existing invoicing tables: `suppliers`, `stock_locations`, `stock_units`, `stock_categories`, `stock_items`, `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_receipt_items`, `supplier_payments`, `stock_movements`, `stock_settings`.
- Write policies restricted like the existing accounts/invoicing rules: create/edit for executives and above, approve/delete/receive/pay for managers and above, super admin unrestricted.
- Stock balance derived from `stock_movements` via a company-scoped SQL view or aggregate query rather than a mutable balance column, so history and balance can never disagree.
- Supplier outstanding computed as opening balance + received/billed value - payments, aggregated in SQL rather than stored, so it can never drift.
- PO and payment-voucher numbering reuse `next_document_number` extended with `purchase_order` and `purchase_payment` doc types in `invoice_number_series`.
- New routes: `c.$slug._app.purchase.tsx` (+ `suppliers`, `suppliers.$supplierId`, `orders`, `orders.$orderId`, `payments`), `c.$slug._app.stock.tsx` (+ `items`, `balance`, `movements`), `c.$slug._app.settings.stock.tsx`. New hooks: `use-suppliers`, `use-supplier-payments`, `use-stock-items`, `use-purchase-orders`, `use-stock-movements`, `use-stock-settings`.
- Nav entries added to `Sidebar.tsx` and `BottomNav.tsx` with permissions `nav.purchase` / `nav.stock` and modules `purchase` / `stock`, so Roles & Permissions controls visibility.

## Build order

1. Migration (tables, RLS, grants, triggers, numbering).
2. Hooks + settings page (stores, units, categories, numbering, print).
3. Suppliers and Items screens.
4. Purchase Orders: list, form, approval, print.
5. Supplier payments, outstanding balances, statement and print voucher.
6. Receiving -> stock in.
7. Stock balance, issue to project/task, transfers, adjustments, movement history.
8. Nav + permissions, dashboard tiles, reports, CSV exports.
