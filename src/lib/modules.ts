export interface ModuleDef {
  key: string;
  label: string;
  description: string;
}

export const MODULES: ModuleDef[] = [
  { key: "leads",       label: "Leads",       description: "Lead pipeline, stages, calendar" },
  { key: "clients",     label: "Clients",     description: "Client directory & retainers" },
  { key: "projects",    label: "Projects",    description: "Projects, payments, threads" },
  { key: "tasks",       label: "Tasks",       description: "Personal & assigned tasks" },
  { key: "accounts",    label: "Accounts",    description: "Ledger & pending balances" },
  { key: "invoicing",   label: "Invoicing",   description: "Quotations, invoices & payment receipts" },
  { key: "expenses",    label: "Expenses",    description: "Expense records linked to clients & projects" },
  { key: "purchase",    label: "Purchase",    description: "Suppliers, purchase orders & supplier payments" },
  { key: "stock",       label: "Stock",       description: "Items, stock balance & movements" },
  { key: "employees",   label: "Employees",   description: "Employee directory" },
  { key: "departments", label: "Departments", description: "Departments & routing" },
  { key: "reports",     label: "Reports",     description: "Operational dashboards" },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

export const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "c", "app", "assets", "dashboard", "settings",
  "leads", "clients", "projects", "tasks", "accounts", "employees",
  "departments", "reports", "expenses", "invoicing", "purchase", "stock", "static", "public",
]);

export function isValidSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/.test(s) && !RESERVED_SLUGS.has(s);
}