# Quotations for walk-in customers (no client record needed)

## Goal
Let a quotation be raised for someone who isn't a saved client: type their name and contact details directly, and optionally save them as a client with one click.

## What changes for you

1. **Customer block in the quotation/invoice form**
   - Keep the existing "No client" option in the Client dropdown; when no client is chosen the form shows a small "Walk-in customer" note.
   - New fields next to Bill-to name: **Contact person** and **Contact number** (plus the existing address / GSTIN).
   - Choosing a saved client auto-fills all of these from the client record, as it does today.

2. **"Save as client" action**
   - When no client is selected and a name is filled, a **Save as client** button appears in the customer block.
   - Pressing it creates a client using the typed name, contact person, number and address (status active, default group), then links the quotation to that new client.
   - If a client with the same name already exists, ask before creating a duplicate.

3. **Printing**
   - The printed quotation/invoice shows the contact person and phone under the bill-to block when present.

## Technical notes

- Migration: add `bill_to_contact_person text not null default ''` and `bill_to_contact_number text not null default ''` to `public.quotations` and `public.invoices`. No policy changes (existing company-scoped RLS covers new columns).
- `src/hooks/use-quotations.ts` and `src/hooks/use-invoices.ts`: add the two fields to the row/input types and to `docPayload`.
- `src/components/invoicing/DocumentFormDialog.tsx`: extend `DocFormValue`, add the two inputs, extend `pickClient` to fill them from `ClientRow.contact_person` / `contact_number`, and add the `Save as client` button using `addClient` from `useClientsData` (guarded by `useConfirm` on duplicate name).
- `src/routes/c.$slug._app.invoicing.quotations.tsx` and `...invoices.tsx`: pass the new fields through `initial` and the submit payload.
- `src/lib/invoice-print.ts`: accept `billToContactPerson` / `billToContactNumber` and render them in the bill-to block; pass from both print handlers.
