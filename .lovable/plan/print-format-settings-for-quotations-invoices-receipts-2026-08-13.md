# Print Format Settings for Quotations, Invoices & Receipts

Add a "Print & Paper" group in Settings → Invoicing that controls how every printed/PDF document looks.

## What you get

### 1. Paper size
- Choose **A4** or **A5**, applied to quotations, invoices and payment receipts.
- Optional separate size for receipts (many businesses print receipts on A5) — one toggle "use same size for receipts".

### 2. Three professional templates
Selectable with a labelled preview card each:
- **Classic** — bordered table, serif headings, formal GST layout (current style, refined).
- **Modern** — accent colour band header, borderless zebra rows, generous spacing.
- **Compact** — tight rows and smaller type, fits more line items per page (best for A5 / long item lists).

All three keep the full GST-compliant content: company/legal block, GSTIN, bill-to, HSN/SAC, per-rate tax summary, totals, amount in words, bank details, signature and footer note.

### 3. Next-page (multi-page) settings
- **Rows per page** — max line items on the first page and on continuation pages (auto defaults per paper size, editable).
- **Repeat table header** on every page.
- **Repeat company header** on continuation pages, or show a slim "Document No. — continued" strip instead.
- **Page numbers** — "Page X of Y" in the footer, toggleable.
- Totals, tax summary, bank details and signature block always stay together on the last page (no split across pages).
- Optional **"Continued…"** marker at the bottom of pages that are not the last.

### 4. Live preview
"Preview print" button in settings opens a sample document using the chosen template, paper size and pagination so choices can be checked without creating a real invoice.

## Technical notes
- Migration adds to `invoice_settings`: `paper_size` (`A4`/`A5`), `receipt_paper_size`, `print_template` (`classic`/`modern`/`compact`), `rows_first_page`, `rows_next_page`, `repeat_table_header`, `repeat_brand_header`, `show_page_numbers`, `show_continued_marker`, plus `print_accent_color` for the Modern band. All with sensible defaults so existing rows keep working.
- `src/lib/invoice-print.ts` is refactored: shared content builders (brand block, items, tax summary, totals, bank, signature) plus a `PrintOptions` argument; three CSS themes and an `@page { size: A4|A5 }` rule; page breaking done with CSS (`break-inside: avoid`, chunking items into `.page` blocks by rows-per-page) and CSS counters for "Page X of Y".
- `use-invoice-settings.ts` interface extended; `use-print-brand.ts` returns the print options alongside the brand so the three invoicing routes pass them straight into `buildDocumentHtml` / `buildReceiptHtml` without other changes.
- Settings page gains a "Print & Paper" card, following the existing card/save-button pattern.

## Build order
1. Migration for the new settings columns.
2. Extend settings hook + print-brand hook.
3. Refactor `invoice-print.ts` into themed templates with pagination.
4. Settings → Invoicing UI card with template previews and preview-print button.
5. Wire the three invoicing routes to pass print options.
