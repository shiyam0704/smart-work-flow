# Multi-line Expense Entries

Today one expense record holds a single title, one category and one amount. You want a single expense entry to hold several lines, for example:

```text
Product X · Category A · ₹200
Product Z · Category B · ₹200
------------------------------
Total                    ₹400
```

## How it will work

**New expense form**
- The form keeps the shared fields at the top: date, paid via, client link, project link, note.
- Below that, an **Items** table where each row has: description, category (dropdown, with the option to add a new category inline), quantity, rate, and a computed line amount.
- "Add item" adds another row; each row has a remove button. The last remaining row cannot be removed.
- A live **Total** shows the sum of all rows. That total becomes the expense amount, so you never type it manually.
- A single-line expense stays just as fast: one row is present by default.

**Expenses list**
- The list keeps one row per expense entry (unchanged totals and filters).
- Multi-item entries show a small "2 items" badge and can be expanded to show the item lines with their own category and amount.
- Category filter matches an expense if any of its items uses that category; the same for the search box.
- CSV export gains an item-level option: export one row per item (date, entry title, item description, item category, quantity, rate, amount) alongside the existing entry-level export.

**Editing**
- Opening an existing expense loads its items, and rows can be added, edited or removed. Total recalculates on save.
- Existing single-amount expenses keep working: they display as one item using their current title, category and amount.

**Reports and dashboard**
- Account totals and dashboard expense figures continue to use the entry total, so no numbers change.
- Category breakdowns become item-accurate instead of assigning the whole entry to one category.

## Technical notes

- New table `public.expense_items`: `company_id`, `expense_id` (cascade delete), `description`, `category`, `quantity`, `rate`, `amount`, `sort_order`, timestamps. Grants for `authenticated` and `service_role`, RLS mirroring the existing `expenses` policies (company-scoped read, manager-and-above write), plus the audit-log trigger used by other tables.
- `expenses.amount` remains the source of truth for totals and is written as the sum of the item rows; `expenses.category` is set to the first item's category (or "Multiple") for backward compatibility with existing filters and reports.
- `useExpenses` gains item fetching (single query joined by `expense_id`), and `addExpense`/`updateExpense` write parent + items together (delete-and-reinsert items on update).
- A backfill in the same migration creates one `expense_items` row per existing expense so historical data renders through the same UI.
- `EditExpenseModal` is refactored to a line-items editor following the pattern already used by `LineItemsEditor` in invoicing.
