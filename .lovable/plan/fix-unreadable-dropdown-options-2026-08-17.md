# Fix unreadable dropdown options

## Problem
The "Per page" dropdown on the Clients page renders its option list with the same colour for text and background, so the numbers (12 / 24 / 48 / 96) are invisible until hovered. The select is styled `bg-transparent`, so the native option popup has no real background colour and falls back to a colour that matches the inherited text colour.

## Fix
1. Clients page ("Per page" dropdown): replace `bg-transparent` with solid surface + text tokens so both the closed control and the open option list have proper contrast, and set explicit option colours.
2. Apply the same option colour treatment to the other native dropdowns (timezone, date format, time format) in Company settings and the platform admin dialog, so they stay readable in light and dark themes.
3. Keep the existing sizing, border and glass look; only colour changes.

## Technical notes
- Files: `src/routes/c.$slug._app.clients.index.tsx`, `src/routes/c.$slug._app.settings.company.tsx`, `src/routes/admin.index.tsx`.
- Use semantic tokens only (`bg-background`/`bg-popover`, `text-foreground`), no hardcoded hex or `text-white`.
- Add a small global rule in `src/styles.css` for `select option` (background: popover, colour: popover-foreground) so every native select inherits readable options, since Chrome/Android renders options from these properties.
