# Make Roles & Permissions actually control the app

## The problem

The switches in Settings → Roles & Permissions are only partly wired up.

- Leads: the Leads list and lead detail pages decide who can add, edit or advance a lead purely from the role name — "Admin or Manager". Turning on "Manage Leads" for Staff therefore changes nothing: the buttons stay hidden.
- The same role-name shortcut is used on Clients, Projects, Employees, project receipts and expenses cards, task detail and project discussion.
- Deleting a lead, client, project or task is also blocked in the database for anyone below Manager, so even after the buttons appear, deletion would fail with a permission error.

Menu visibility (which pages appear in the sidebar) already follows the switches correctly.

## What will change

1. Every add / edit / advance / delete control across the app is driven by the matching switch in Roles & Permissions, not by the role name.
   - Leads, Clients, Projects, Departments, Employees, Tasks, Accounts (income, expenses, cash & bank), Invoicing, Purchase, Stock, Reports, Settings.
2. Database rules follow the switches too, so a role granted Manage can add, edit and delete — as chosen. Where no switch has been set for a role, today's behaviour is kept unchanged.
3. Admin and Super Admin keep full access always; a role with only "View" keeps read-only screens with no action buttons.
4. Inactive employees stay locked out regardless of switches.
5. A verification pass: for each module, check that View-only and Manage roles behave as expected, and that an action allowed in the UI never fails with a permission error.

## Technical detail

- Replace `isAdmin || isManager` gating with `useCanManage(menu)` / `useHasPermission(key)` in: `c.$slug._app.leads.index.tsx`, `c.$slug._app.leads.$leadId.tsx`, `clients.index.tsx`, `clients.$clientId.tsx`, `projects.index.tsx`, `projects.$projectId.tsx`, `employees.tsx`, `PaymentsCard.tsx`, `ExpensesCard.tsx`, `TaskDetailDialog.tsx`, `ProjectThreadButton.tsx`. Sidebar role label stays as-is (display only).
- Add a security-definer helper `private.has_perm(_uid uuid, _key text)`: super admin / admin → true; otherwise look up `role_permissions` for the user's roles in the current company; if an explicit row exists use it, otherwise fall back to the existing role-rank check so untouched companies behave exactly as before.
- Rewrite the `... manager delete` policies on `leads`, `lead_stage_entries`, `clients`, `projects`, `tasks` (and matching child tables: task assignees/comments/attachments, project comments/attachments, lead attachments) to use `private.has_perm(auth.uid(), 'manage.<module>')` together with the existing company-scope check. Also apply the manage check to insert/update where today any company member can write, so View-only roles cannot write through the API.
- Keep finance tables (invoices, payments, expenses, purchase, stock) on their manage keys: `manage.invoicing`, `manage.accounts`, `manage.expenses`, `manage.purchase`, `manage.stock`, `manage.accounts.book`.
- Grant `EXECUTE` on the new helper to `authenticated`.
- Verify with `bunx tsgo --noEmit`, the RLS test script in `tests/rls/`, and a signed-in click-through of Leads as a Staff role with Manage Leads on and off.
