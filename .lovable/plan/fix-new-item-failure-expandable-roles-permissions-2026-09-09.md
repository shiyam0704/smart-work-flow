# Fix "New item" failure + expandable Roles & Permissions

## 1. Why adding a stock item fails

Confirmed cause (checked in the database, not guessed): the internal helper the access rules call for Stock and Purchase writes — `private.is_executive_or_above` — has execute rights only for the database owner. Every signed-in user, admin included, hits `permission denied for function is_executive_or_above` the moment they try to save.

The same helper guards writes on: stock items, stock movements, suppliers, purchase orders, purchase order items, purchase receipts and receipt items. So all of those save paths are broken today, not just stock items.

Fix: one database change granting execute on that helper to signed-in users (matching the other helpers, which already have it), plus a sweep granting execute on any other helper in that internal set that is missing it. No rule is loosened — the same role checks still apply.

Then verify by adding an item, a supplier and a purchase order as a company admin.

## 2. Roles & Permissions — one row per menu, expandable

Rebuild the page to match the reference layout:

```text
Module / Permission        Admin   Manager   Executive   Officer   Staff
> Dashboard          (2)    All      [on]      [on]        [on]     [on]
v Stock              (2)    All      [on]      partial     [off]    [off]
    View stock              Always   [on]      [on]         [off]    [off]
    Manage stock            Always   [on]      [off]        [off]    [off]
> Invoicing          (2)    All      [on]      [off]       [off]    [off]
```

- Each menu is a collapsed row with a chevron and a count of the permissions inside; clicking expands its permissions underneath.
- Every menu gets exactly two permissions: **View** (open the menu and read) and **Manage** (add, edit, delete inside it).
- The collapsed row shows a roll-up switch per role: on when both are on, off when both off, and a small "partial" marker when mixed. Toggling the roll-up sets both permissions for that role at once.
- Admin column stays a fixed "All" / "Always" badge.
- Sticky header and sticky first column so role columns stay readable while scrolling; horizontal scroll on small screens.
- Existing saved settings are preserved: today's `nav.*` keys become the View permission of each menu, so nothing a company has already configured is lost.

Menus covered: Dashboard, My Tasks, Leads, Clients, Projects, Departments, Employees, Accounts (incl. Expenses), Invoicing, Purchase, Stock, Reports, Settings, Audit Trail — plus the existing financial-data and settings-section permissions kept inside their menus.

## 3. Enforcement

The new Manage permissions are wired where the app already checks access, so a role with View but not Manage sees the pages read-only: the add/edit/delete buttons for that menu are hidden. View behaviour is unchanged.

## Technical notes

- Migration: `GRANT EXECUTE ON FUNCTION private.is_executive_or_above(uuid) TO authenticated;` and a guarded sweep over `private` helper functions referenced by policies, granting `authenticated` where `proacl` lacks it. Followed by a linter run.
- `src/lib/permissions.ts`: restructure `PERMISSIONS` into a `MENUS` array (`key`, `label`, `icon-free label`, `moduleKey`, `permissions: [view, manage]`), keeping existing `nav.*` keys as the view keys and adding `manage.*` keys with role defaults mirroring today's write behaviour (manage defaults on for manager, off below).
- `src/routes/c.$slug._app.settings.roles.tsx`: rewrite as a collapsible table using shadcn `Collapsible`; roll-up switch computes on/off/partial from the child rows and calls `setAllowed` for each child on toggle.
- `src/hooks/use-permissions.ts`: add a `useCanManage(menuKey)` helper alongside `useHasPermission`, so pages can gate action buttons.
- Action-button gating applied in the stock, purchase, invoicing, clients, projects, leads, expenses and employees list pages via the new helper.
