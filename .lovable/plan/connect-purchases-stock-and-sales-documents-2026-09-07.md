# Connect Purchases, Stock and Sales Documents

Goal: purchases feed stock, sales documents can bill items from stock, and the dashboard shows how stock is moving and what is running low.

## 1. Purchase order items feed the stock balance

The purchase order form already lets each line pick a stock item, and receiving goods already creates an "in" movement for every line that has one. What is missing is confidence and clarity:

- Show the linked item name on the purchase order view/print line so it is obvious which lines will move stock.
- On the Receive Goods screen, flag lines with no stock item as "will not update stock" so nothing is silently skipped.
- Prevent receiving more than the outstanding quantity on a line.
- After receiving, refresh the stock balance and item lists so the new quantity appears immediately.

## 2. Quotation and invoice lines can be billed from stock

- Each quotation and invoice line gets an optional "Item" picker listing active stock items.
- Choosing an item fills description, unit, rate (selling/purchase rate) and tax percent, all still editable.
- The chosen item is stored on the line so reports can tell which sold lines came from stock.
- No stock is deducted automatically. Stock going out stays a manual entry in Stock → Movements (as you chose), and the invoice view shows a hint with a link to record the outward movement.
- No separate Sales module is added; Invoicing stays the sales area.

## 3. Verify the money and stock loop

Walk the real flow in the app and confirm each screen updates:

1. Create a purchase order with stock-linked items and approve it.
2. Receive goods → stock balance and item quantities increase, movement appears in Stock → Movements.
3. Record a supplier payment → supplier outstanding drops on Purchase → Payments and on the supplier detail page.
4. Confirm the dashboard purchase/stock tiles reflect both actions.

Any mismatch found here is fixed as part of this work.

## 4. Dashboard: stock turnover and low-stock alerts

Inside the existing Purchase & Stock dashboard section, respecting the selected date range where it makes sense:

- Stock in vs stock out value for the range, with net change.
- Turnover indicator: value consumed in the range against average stock value held.
- Low-stock alert list: items at or below their minimum level, with current quantity and shortfall, linking to the item.
- Top moving items for the range.
- Tiles stay hidden for users without stock/purchase access.

## Technical notes

- Migration: add nullable `item_id` (references `public.stock_items`) to `public.invoice_items` and `public.quotation_items`, with company-scoped indexes; existing RLS/grants unchanged.
- `LineItemInput` in `src/lib/invoice-calc.ts` gains `item_id`; `LineItemsEditor` gets the item select; `use-invoices.ts` / `use-quotations.ts` persist and read it.
- Receive Goods guard on `received_quantity` in `use-purchase-orders.ts`; invalidate stock item/movement queries after `receiveOrder`.
- Dashboard aggregates computed client-side from `stock_movements` + `stock_items` (min_stock, purchase_rate), reusing the current date-range state.
