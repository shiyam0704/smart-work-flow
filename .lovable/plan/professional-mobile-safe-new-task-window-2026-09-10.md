# Professional, mobile-safe New Task window

## What will change

- Refresh the New Task window with clearer spacing, stronger section grouping, and a cleaner header while preserving every current field and task-creation rule.
- Keep the title and main task details easy to scan, then visually separate optional links, scheduling, description, and attachments.
- Change Status, Priority, and Due Date from a fixed three-column row to one column on phones and three columns where space allows, preventing overlap.
- Make all picker buttons and selected values shrink safely, truncating long client, project, department, and employee names instead of widening the window.
- Constrain attachment rows to the available width; long filenames will truncate while file size and remove controls remain visible.
- Give the form body its own scrolling area and keep Cancel/Create Task in a fixed footer, so long filenames or many attachments can never push the Create button out of reach.
- Make the footer buttons comfortable on phones and retain clear disabled and “Creating…” states.

## Validation

- Check the window at phone and desktop widths with a very long attachment filename and multiple attachments.
- Confirm Status, Priority, and Due Date never overlap and all dropdowns remain usable.
- Confirm Create Task stays visible, task creation and attachment upload still work, and no console errors appear.

## Technical details

- Scope changes to `NewTaskModal.tsx` and `TaskAttachmentsField.tsx`; no database, permissions, or task behavior changes.
- Use the existing design tokens and Button controls, with responsive grid tracks, `min-w-0`, overflow containment, and a sticky/fixed action footer inside the modal.
