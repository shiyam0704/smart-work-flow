import { useLocation, getRouteApi } from "@tanstack/react-router";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";
import { LayoutDashboard, Users, Building2, ListChecks, Settings, LogOut, Sparkles, FolderKanban, Briefcase, BarChart3, Wallet, ReceiptText, ChevronRight, ShoppingCart, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Building2 as BrandFallback } from "lucide-react";
import { useRolePermissions } from "@/hooks/use-permissions";
import { useActiveCompany, useCompanyModules } from "@/hooks/use-company";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const slugRoute = getRouteApi("/c/$slug");
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";


type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: string;
  permission: string;
  module?: string;
  children?: { to: string; label: string; permission?: string }[];
};

const LEADS_ITEM: NavItem = { to: "/c/$slug/leads", label: "Leads", icon: Sparkles, match: "/leads", permission: "nav.leads", module: "leads" };
const EMPLOYEES_ITEM: NavItem = { to: "/c/$slug/employees", label: "Employees", icon: Users, permission: "nav.employees", module: "employees" };

const nav: NavItem[] = [
  { to: "/c/$slug/dashboard",   label: "Dashboard",   icon: LayoutDashboard, permission: "nav.dashboard" },
  { to: "/c/$slug/tasks",       label: "My Tasks",    icon: ListChecks,      permission: "nav.tasks",       module: "tasks" },
  { to: "/c/$slug/clients",     label: "Clients",     icon: Building2,       permission: "nav.clients",     module: "clients" },
  { to: "/c/$slug/projects",    label: "Projects",    icon: FolderKanban, match: "/projects",    permission: "nav.projects",    module: "projects" },
  { to: "/c/$slug/departments", label: "Departments", icon: Briefcase,    match: "/departments", permission: "nav.departments", module: "departments" },
  {
    to: "/c/$slug/accounts", label: "Accounts", icon: Wallet, match: "/accounts",
    permission: "nav.accounts", module: "accounts",
    children: [
      { to: "/c/$slug/accounts/income",   label: "Income",   permission: "nav.accounts.income" },
      { to: "/c/$slug/accounts/expenses", label: "Expenses", permission: "nav.expenses" },
      { to: "/c/$slug/accounts/book",     label: "Accounts", permission: "nav.accounts.book" },
    ],
  },
  {
    to: "/c/$slug/invoicing", label: "Invoicing", icon: ReceiptText, match: "/invoicing",
    permission: "nav.invoicing", module: "invoicing",
    children: [
      { to: "/c/$slug/invoicing/quotations", label: "Quotations", permission: "nav.invoicing" },
      { to: "/c/$slug/invoicing/invoices",   label: "Invoices",   permission: "nav.invoicing" },
      { to: "/c/$slug/invoicing/pending",     label: "Pending",    permission: "nav.invoicing.pending" },
    ],
  },
  {
    to: "/c/$slug/purchase", label: "Purchase", icon: ShoppingCart, match: "/purchase",
    permission: "nav.purchase", module: "purchase",
    children: [
      { to: "/c/$slug/purchase/orders",    label: "Purchase Orders",    permission: "nav.purchase" },
      { to: "/c/$slug/purchase/suppliers", label: "Suppliers",          permission: "nav.purchase" },
      { to: "/c/$slug/purchase/pending",   label: "Supplier Pending",   permission: "nav.purchase.pending" },
    ],
  },
  {
    to: "/c/$slug/stock", label: "Stock", icon: Boxes, match: "/stock",
    permission: "nav.stock", module: "stock",
    children: [
      { to: "/c/$slug/stock/balance",   label: "Stock Balance", permission: "nav.stock" },
      { to: "/c/$slug/stock/items",     label: "Items",         permission: "nav.stock" },
      { to: "/c/$slug/stock/movements", label: "Movements",     permission: "nav.stock" },
    ],
  },
  { to: "/c/$slug/employees",   label: "Employees",   icon: Users,        permission: "nav.employees",   module: "employees" },
  { to: "/c/$slug/reports",     label: "Reports",     icon: BarChart3,    match: "/reports",     permission: "nav.reports",     module: "reports" },
  { to: "/c/$slug/settings",    label: "Settings",    icon: Settings,     match: "/settings",    permission: "nav.settings" },
];


export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles, isAdmin, isManager, isExecutive, isOfficer, canAccessLeads, canAccessEmployees } = useAuth();
  const { isAllowed } = useRolePermissions();
  const { company } = useActiveCompany();
  // Branding from the /c/$slug loader is keyed on the URL and available
  // synchronously on tenant switch, so prefer it over the async companies cache.
  const branding = slugRoute.useLoaderData();
  const brandLogo = branding?.logoUrl ?? company?.logo_url ?? null;
  const brandName = branding?.name ?? company?.name ?? "Smart Work Flow";
  const { isEnabled } = useCompanyModules(company?.id ?? null);
  const [fullName, setFullName] = useState<string>("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Auto-expand the group that contains the current route.
  useEffect(() => {
    const slugPrefix = location.pathname.match(/^\/c\/[^/]+/)?.[0] ?? "";
    const group = nav.find((i) => {
      if (!i.children?.length || !i.match) return false;
      const prefix = `${slugPrefix}${i.match}`;
      return location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);
    });
    if (group) setOpenGroup(group.to);
  }, [location.pathname]);



  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setFullName(data?.full_name ?? user.email ?? ""));
  }, [user]);

  const currentRole = isAdmin
    ? "admin"
    : isManager
    ? "manager"
    : isExecutive
    ? "executive"
    : isOfficer
    ? "officer"
    : "staff";
  const roleLabel = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    if (company) navigate({ to: "/c/$slug/auth", params: { slug: company.slug } });
    else navigate({ to: "/auth" });
  }

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-background border-r border-glass-border h-dvh sticky top-0">
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl overflow-hidden shadow-glow ring-1 ring-glass-border bg-white grid place-items-center">
          {brandLogo
            ? <img key={brandLogo} src={brandLogo} alt={brandName} className="w-full h-full object-cover" />
            : <BrandFallback className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div>
          <div className="font-display font-bold text-base leading-tight truncate">{brandName}</div>
          <div className="text-[10px] text-muted-foreground truncate">powered by Smart Workflow</div>
        </div>
      </div>
      <nav className="px-3 py-2 flex-1 space-y-1">
        {(() => {
          const permitted = (perm: string) =>
            isAdmin || roles.some((r) => isAllowed(r, perm));
          const moduleOn = (m?: string) => (m ? isEnabled(m) : true);
          const items = nav.filter((item) => {
            if (!moduleOn(item.module)) return false;
            // Leads / Employees also honor employee flags
            if (item.to === "/c/$slug/leads") return permitted(item.permission) || canAccessLeads;
            if (item.to === "/c/$slug/employees") return permitted(item.permission) || canAccessEmployees;
            return permitted(item.permission);
          });
          // Ensure Leads / Employees appear even when not in `nav` array (kept for backward reference)
          if (canAccessLeads && moduleOn("leads") && !items.some((i) => i.to === "/c/$slug/leads")) items.splice(1, 0, LEADS_ITEM);
          if (canAccessEmployees && moduleOn("employees") && !items.some((i) => i.to === "/c/$slug/employees")) {
            const tailIdx = items.findIndex((i) => i.to === "/c/$slug/reports" || i.to.startsWith("/c/$slug/settings"));
            items.splice(tailIdx === -1 ? items.length : tailIdx, 0, EMPLOYEES_ITEM);
          }
          return items.map((item) => {
            const slugPrefix = location.pathname.match(/^\/c\/[^/]+/)?.[0] ?? "";
            const active = item.match
              ? location.pathname === `${slugPrefix}${item.match}` || location.pathname.startsWith(`${slugPrefix}${item.match}/`)
              : location.pathname.endsWith(item.to.replace("/c/$slug", ""));
            const Icon = item.icon;
            if (item.children?.length) {
              const visibleChildren = item.children.filter((child) => !child.permission || permitted(child.permission));
              if (visibleChildren.length === 0) return null;
              const open = openGroup === item.to;
              return (
                <Collapsible
                  key={item.to}
                  open={open}
                  onOpenChange={(o) => setOpenGroup(o ? item.to : null)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        active
                          ? "bg-gradient-primary text-white shadow-glow"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight className={cn("w-4 h-4 transition-transform", open && "rotate-90")} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out">
                    <div className="mt-1 ml-5 pl-3 border-l border-glass-border space-y-1">
                      {visibleChildren.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                          activeProps={{ className: "block px-3 py-2 rounded-lg text-sm font-medium text-primary bg-primary/10 transition-all" }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-gradient-primary text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          });

        })()}
      </nav>
      <div className="p-4 m-3 bg-muted rounded-xl space-y-3 border border-glass-border">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Logged in as</div>
          <div className="text-sm font-semibold truncate">{fullName || user?.email}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[10px] uppercase font-bold px-2 py-0.5 rounded-md",
              isAdmin ? "bg-gradient-primary text-white" : "bg-white/10 text-muted-foreground"
            )}>{roleLabel}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg border border-glass-border hover:bg-white/5 transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
