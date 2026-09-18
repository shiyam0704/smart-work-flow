import { useLocation } from "@tanstack/react-router";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";
import {
  LayoutDashboard,
  Sparkles,
  Building2,
  ListChecks,
  MoreHorizontal,
  FolderKanban,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Database,
  ReceiptText,
  Wallet,
  ChevronDown,
  ShoppingCart,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Fragment, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { useActiveCompany } from "@/hooks/use-company";

type Item = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: string;
  permission: string;
  children?: { to: string; label: string; permission?: string }[];
};

const LEADS_ITEM: Item = { to: "/c/$slug/leads", label: "Leads", icon: Sparkles, match: "/leads", permission: "nav.leads" };

const PRIMARY: Item[] = [
  { to: "/c/$slug/dashboard", label: "Home",    icon: LayoutDashboard, permission: "nav.dashboard" },
  { to: "/c/$slug/tasks",     label: "Tasks",   icon: ListChecks,      permission: "nav.tasks" },
  { to: "/c/$slug/clients",   label: "Clients", icon: Building2,       permission: "nav.clients" },
];

const MORE: Item[] = [
  { to: "/c/$slug/projects",    label: "Projects",    icon: FolderKanban, match: "/projects",    permission: "nav.projects" },
  { to: "/c/$slug/departments", label: "Departments", icon: Briefcase,    match: "/departments", permission: "nav.departments" },
  {
    to: "/c/$slug/purchase", label: "Purchase", icon: ShoppingCart, match: "/purchase", permission: "nav.purchase",
    children: [
      { to: "/c/$slug/purchase/orders",    label: "Purchase Orders",  permission: "nav.purchase" },
      { to: "/c/$slug/purchase/suppliers", label: "Suppliers",        permission: "nav.purchase" },
      { to: "/c/$slug/purchase/pending",   label: "Supplier Pending", permission: "nav.purchase.pending" },
    ],
  },
  {
    to: "/c/$slug/stock", label: "Stock", icon: Boxes, match: "/stock", permission: "nav.stock",
    children: [
      { to: "/c/$slug/stock/balance",   label: "Stock Balance", permission: "nav.stock" },
      { to: "/c/$slug/stock/items",     label: "Items",         permission: "nav.stock" },
      { to: "/c/$slug/stock/movements", label: "Movements",     permission: "nav.stock" },
    ],
  },
  {
    to: "/c/$slug/accounts", label: "Accounts", icon: Wallet, match: "/accounts", permission: "nav.accounts",
    children: [
      { to: "/c/$slug/accounts/income",   label: "Income",   permission: "nav.accounts.income" },
      { to: "/c/$slug/accounts/expenses", label: "Expenses", permission: "nav.expenses" },
      { to: "/c/$slug/accounts/book",     label: "Accounts", permission: "nav.accounts.book" },
    ],
  },
  {
    to: "/c/$slug/invoicing", label: "Invoicing", icon: ReceiptText, match: "/invoicing", permission: "nav.invoicing",
    children: [
      { to: "/c/$slug/invoicing/quotations", label: "Quotations", permission: "nav.invoicing" },
      { to: "/c/$slug/invoicing/invoices",   label: "Invoices",   permission: "nav.invoicing" },
      { to: "/c/$slug/invoicing/pending",     label: "Pending",    permission: "nav.invoicing.pending" },
    ],
  },
  { to: "/c/$slug/employees",   label: "Employees",   icon: Users,        permission: "nav.employees" },
  { to: "/c/$slug/reports",     label: "Reports",     icon: BarChart3,    match: "/reports",     permission: "nav.reports" },
  { to: "/c/$slug/settings",    label: "Settings",    icon: Settings,     match: "/settings",    permission: "nav.settings" },
];


export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, roles, canAccessLeads, canAccessEmployees } = useAuth();
  const { isAllowed } = useRolePermissions();
  const { company } = useActiveCompany();
  const [moreOpen, setMoreOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const permitted = (perm: string) => isAdmin || roles.some((r) => isAllowed(r, perm));
  const primary = PRIMARY.filter((i) => permitted(i.permission));
  if (canAccessLeads && !primary.some((i) => i.to === "/c/$slug/leads")) primary.splice(1, 0, LEADS_ITEM);
  const more = MORE.filter((i) => permitted(i.permission) || (i.to === "/c/$slug/employees" && canAccessEmployees));

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    if (company) navigate({ to: "/c/$slug/auth", params: { slug: company.slug } });
    else navigate({ to: "/auth" });
  }

  const isActive = (item: Item) => {
    if (item.match) {
      const slugPrefix = location.pathname.match(/^\/c\/[^/]+/)?.[0] ?? "";
      const expectedPrefix = `${slugPrefix}${item.match}`;
      return location.pathname === expectedPrefix || location.pathname.startsWith(`${expectedPrefix}/`);
    }
    return location.pathname.endsWith(item.to.replace("/c/$slug", ""));
  };

  const moreActive = more.some(isActive);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-glass-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {primary.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors min-h-14",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors min-h-14",
                  moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="More navigation"
              >
                <MoreHorizontal className="w-5 h-5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {more.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  const tile = cn(
                    "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-glass-border transition w-full",
                    active ? "bg-primary/10 text-primary border-primary/40" : "text-foreground hover:bg-white/5"
                  );
                  if (item.children?.length) {
                    const visibleChildren = item.children.filter((child) => !child.permission || permitted(child.permission));
                    if (visibleChildren.length === 0) return null;
                    const open = expanded === item.to;
                    return (
                      <Fragment key={item.to}>
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : item.to)}
                          className={tile}
                          aria-expanded={open}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-medium flex items-center gap-1">
                            {item.label}
                            <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
                          </span>
                        </button>
                        {open && (
                          <div className="col-span-3 grid grid-cols-3 gap-2 -mt-1">
                            {visibleChildren.map((child) => (
                              <Link
                                key={child.to}
                                to={child.to}
                                onClick={() => setMoreOpen(false)}
                                className="px-3 py-2.5 rounded-lg text-xs font-medium text-center border border-glass-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
                                activeProps={{ className: "px-3 py-2.5 rounded-lg text-xs font-medium text-center border border-primary/40 bg-primary/10 text-primary transition" }}
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </Fragment>
                    );
                  }
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={tile}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                  );
                })}

                <button
                  type="button"
                  onClick={async () => {
                    setMoreOpen(false);
                    await handleLogout();
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-glass-border text-destructive hover:bg-destructive/10 transition"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-xs font-medium">Sign out</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
