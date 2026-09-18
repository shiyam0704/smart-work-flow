import type { AppRole } from "@/hooks/use-auth";

export type NonAdminRole = Exclude<AppRole, "admin" | "super_admin">;
export const NON_ADMIN_ROLES: NonAdminRole[] = ["manager", "executive", "officer", "staff"];
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  executive: "Executive",
  officer: "Officer",
  staff: "Staff",
};
export const ROLE_HINTS: Record<AppRole, string> = {
  super_admin: "Platform owner",
  admin: "Full control",
  manager: "Cross-dept",
  executive: "Assigned modules",
  officer: "Dept-level",
  staff: "View mostly",
};

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  group: string;
  defaults: Record<NonAdminRole, boolean>;
}

const F = { manager: false, executive: false, officer: false, staff: false } as const;
const M = { manager: true, executive: false, officer: false, staff: false } as const;
const ME = { manager: true, executive: true, officer: false, staff: false } as const;

export const PERMISSIONS: PermissionDef[] = [
  // Core
  { key: "nav.dashboard",   group: "Home",       label: "View Dashboard",   description: "Access the main dashboard", defaults: { manager: true, executive: true, officer: true, staff: true } },
  { key: "nav.tasks",       group: "Home",       label: "View My Tasks",    description: "Personal task list",        defaults: { manager: true, executive: true, officer: true, staff: true } },
  { key: "manage.tasks",    group: "Home",       label: "Manage Tasks",     description: "Create, edit and delete tasks", defaults: { manager: true, executive: true, officer: true, staff: false } },

  // Work
  { key: "nav.leads",       group: "Sales",      label: "View Leads",       description: "Access lead pipeline",       defaults: { ...F } },
  { key: "manage.leads",    group: "Sales",      label: "Manage Leads",     description: "Add, edit, advance and delete leads", defaults: { ...M } },
  { key: "nav.clients",     group: "Operations", label: "View Clients",     description: "Access client directory",    defaults: { manager: true, executive: true, officer: false, staff: false } },
  { key: "manage.clients",  group: "Operations", label: "Manage Clients",   description: "Add, edit, import and delete clients", defaults: { ...ME } },
  { key: "nav.projects",    group: "Operations", label: "View Projects",    description: "Access project workspace",   defaults: { manager: true, executive: true, officer: false, staff: false } },
  { key: "manage.projects", group: "Operations", label: "Manage Projects",  description: "Add, edit and delete projects", defaults: { ...ME } },
  { key: "nav.departments", group: "Operations", label: "View Departments", description: "Access department pages",    defaults: { manager: true, executive: true, officer: true, staff: false } },
  { key: "manage.departments", group: "Operations", label: "Manage Departments", description: "Change department work and assignments", defaults: { ...ME } },
  { key: "nav.employees",   group: "Operations", label: "View Employees",   description: "Access employee directory",  defaults: { ...F } },
  { key: "manage.employees", group: "Operations", label: "Manage Employees", description: "Add, edit and deactivate employees", defaults: { ...M } },

  // Money & insights
  { key: "nav.accounts",    group: "Finance",    label: "View Accounts",    description: "Income, expenses and cash / bank accounts", defaults: { manager: true, executive: false, officer: false, staff: false } },
  { key: "manage.accounts", group: "Finance",    label: "Manage Accounts",  description: "Record and edit money received and spent", defaults: { ...M } },
  { key: "nav.accounts.income",  group: "Finance", label: "View Income",     description: "All money received, from invoices and projects", defaults: { ...M } },
  { key: "nav.accounts.book",    group: "Finance", label: "View Cash & Bank", description: "Balances of each cash box, bank account and wallet", defaults: { ...M } },
  { key: "manage.accounts.book", group: "Finance", label: "Manage Cash & Bank", description: "Add accounts and record transfers between them", defaults: { ...M } },
  { key: "nav.expenses",    group: "Finance",    label: "View Expenses",    description: "Record and review company expenses", defaults: { manager: true, executive: false, officer: false, staff: false } },
  { key: "manage.expenses", group: "Finance",    label: "Manage Expenses",  description: "Add, edit and delete expense records", defaults: { ...M } },
  { key: "nav.invoicing",   group: "Finance",    label: "View Invoicing",   description: "Quotations, invoices and payment receipts", defaults: { manager: true, executive: false, officer: false, staff: false } },
  { key: "manage.invoicing", group: "Finance",   label: "Manage Invoicing", description: "Create and edit quotations, invoices and receipts", defaults: { ...M } },
  { key: "nav.invoicing.pending", group: "Finance", label: "View Invoice Pending", description: "Unpaid and part-paid invoices with balance due", defaults: { ...M } },
  { key: "data.financials", group: "Finance",    label: "View Financial Data", description: "Project payments, client totals, and finance KPIs", defaults: { manager: true, executive: false, officer: false, staff: false } },
  { key: "nav.purchase",    group: "Finance",    label: "View Purchase",    description: "Suppliers, purchase orders and supplier payments", defaults: { manager: true, executive: false, officer: false, staff: false } },
  { key: "manage.purchase", group: "Finance",    label: "Manage Purchase",  description: "Add suppliers, raise orders and record payments", defaults: { ...M } },
  { key: "nav.purchase.pending", group: "Finance", label: "View Supplier Pending", description: "Amounts still payable to each supplier", defaults: { ...M } },

  { key: "nav.stock",       group: "Operations", label: "View Stock",       description: "Items, stock balance and movements", defaults: { manager: true, executive: true, officer: false, staff: false } },
  { key: "manage.stock",    group: "Operations", label: "Manage Stock",     description: "Add items and record stock movements", defaults: { ...ME } },
  { key: "nav.reports",     group: "Insights",   label: "View Reports",     description: "Operational dashboards",     defaults: { manager: true, executive: false, officer: false, staff: false } },

  // Admin
  { key: "nav.settings",    group: "Admin",      label: "Open Settings",    description: "Configure the workspace",    defaults: { ...F } },
  { key: "settings.appearance", group: "Admin",  label: "Manage Appearance", description: "Change workspace theme & palette", defaults: { ...F } },
  { key: "settings.company",    group: "Admin",  label: "Manage Company",    description: "Company branding, timezone & formats", defaults: { ...F } },
  { key: "settings.invoicing",  group: "Admin",  label: "Manage Invoicing",  description: "Tax details, number series, terms and bank details", defaults: { ...F } },
  { key: "settings.stock",      group: "Admin",  label: "Manage Stock & Purchase", description: "Stores, units, categories, numbering and print options", defaults: { ...F } },
  { key: "nav.audit",           group: "Admin",  label: "View Audit Trail",  description: "See who changed what and when across the workspace", defaults: { ...F } },
];

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

export function defaultAllowed(role: AppRole, key: string): boolean {
  if (role === "admin" || role === "super_admin") return true;
  const def = PERMISSIONS.find((p) => p.key === key);
  return def ? def.defaults[role as NonAdminRole] : false;
}

/** A menu in the sidebar, with the permissions that belong to it. */
export interface MenuDef {
  key: string;
  label: string;
  description: string;
  module?: string;
  /** Permission keys inside this menu, in display order. */
  keys: string[];
}

export const PERMISSION_MENUS: MenuDef[] = [
  { key: "dashboard",   label: "Dashboard",    description: "Workspace overview",                     keys: ["nav.dashboard"] },
  { key: "tasks",       label: "My Tasks",     description: "Personal and assigned tasks",            module: "tasks",       keys: ["nav.tasks", "manage.tasks"] },
  { key: "leads",       label: "Leads",        description: "Lead pipeline and stages",               module: "leads",       keys: ["nav.leads", "manage.leads"] },
  { key: "clients",     label: "Clients",      description: "Client directory",                       module: "clients",     keys: ["nav.clients", "manage.clients"] },
  { key: "projects",    label: "Projects",     description: "Project workspace",                      module: "projects",    keys: ["nav.projects", "manage.projects"] },
  { key: "departments", label: "Departments",  description: "Departments and routing",                module: "departments", keys: ["nav.departments", "manage.departments"] },
  { key: "accounts",    label: "Accounts",     description: "Income, expenses and cash / bank accounts", module: "accounts",  keys: ["nav.accounts", "manage.accounts", "nav.accounts.income", "nav.expenses", "manage.expenses", "nav.accounts.book", "manage.accounts.book", "data.financials"] },
  { key: "invoicing",   label: "Invoicing",    description: "Quotations, invoices and pending",       module: "invoicing",   keys: ["nav.invoicing", "manage.invoicing", "nav.invoicing.pending"] },
  { key: "purchase",    label: "Purchase",     description: "Orders, suppliers and supplier pending", module: "purchase",    keys: ["nav.purchase", "manage.purchase", "nav.purchase.pending"] },

  { key: "stock",       label: "Stock",        description: "Items, balance and movements",           module: "stock",       keys: ["nav.stock", "manage.stock"] },
  { key: "employees",   label: "Employees",    description: "Employee directory",                     module: "employees",   keys: ["nav.employees", "manage.employees"] },
  { key: "reports",     label: "Reports",      description: "Operational dashboards",                 module: "reports",     keys: ["nav.reports"] },
  { key: "settings",    label: "Settings",     description: "Workspace configuration",                keys: ["nav.settings", "settings.company", "settings.appearance", "settings.invoicing", "settings.stock"] },
  { key: "audit",       label: "Audit Trail",  description: "Change history",                         keys: ["nav.audit"] },
];

export function permissionByKey(key: string): PermissionDef | undefined {
  return PERMISSIONS.find((p) => p.key === key);
}

/** Permission key that controls add/edit/delete inside a menu, if any. */
export function manageKeyForMenu(menuKey: string): string | null {
  const menu = PERMISSION_MENUS.find((m) => m.key === menuKey);
  return menu?.keys.find((k) => k.startsWith("manage.")) ?? null;
}
