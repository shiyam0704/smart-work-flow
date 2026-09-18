# Reorder invoice/quotation form: customer details at top

## Goal
Move the customer details block to the top of the New/Edit Quotation and Invoice dialog so it appears immediately after the header, before subject and date fields. The current layout asks for customer name, then subject and dates, then shows customer details again, which feels unprofessional.

## What changes
1. In `src/components/invoicing/DocumentFormDialog.tsx`, reorder the form grid so the **Customer details** panel (Customer/bill to name, Contact person, Contact number, Address, GSTIN, Inter-state toggle, and the “Save as client” / “Walk-in customer” chips) renders first.
2. Keep the existing fields and behaviour intact:
   - Selecting a saved client still auto-fills the customer fields.
   - The “Walk-in customer” note and “Save as client” button remain inside the customer panel.
   - The Client and Project selectors stay immediately after the customer panel so picking a client populates the block just above.
3. No backend, database, or print changes are required; this is purely a form layout change.

## Outcome
The form will read as: Customer details → Client / Project / Status → Subject → dates → Place of supply → Line items → Notes / Terms.
