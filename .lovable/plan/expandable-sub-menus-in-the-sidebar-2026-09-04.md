# Expandable sub-menus in the sidebar

Make main menu items with sections expand into sub-items inside the sidebar (Hostinger style), instead of only showing tabs after the page loads.

## Behaviour

- Menu items that have sections get a chevron. Clicking the parent expands a nested list of sub-items directly under it in the sidebar.
- The group containing the current page is expanded automatically; the active sub-item is highlighted.
- Clicking a sub-item navigates to it. Clicking the parent of a group navigates to its default page and expands the group.
- Only one group open at a time (accordion), with a smooth slide/height animation.
- Same grouping is added to the mobile "More" sheet: tapping a grouped item reveals its sub-items instead of navigating away blindly.

## Groups

- Accounts: Expenses, Pending Details, Ledger
- Invoicing: Quotations, Invoices, Payments

Everything else stays a single link, including Reports and Settings — they keep their current index pages and behaviour.

## In-page tabs

The existing tab strips on Accounts and Invoicing stay as they are so the page still shows where you are. Only the sidebar gains the nested navigation.


## Technical notes

- `src/components/app/Sidebar.tsx`: extend `NavItem` with an optional `children: NavItem[]`, render grouped items with a collapsible container (shadcn `Collapsible`), keep existing permission + module filtering applied to both parent and children (a group hides if no child is permitted).
- Active detection reuses the current pathname matching; group open state is local `useState` seeded from the active route and synced on route change.
- `src/components/app/BottomNav.tsx`: same grouping data drives an expandable list inside the More sheet.
- No route, data, or permission-logic changes.
