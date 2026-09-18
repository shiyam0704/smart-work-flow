import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { RoleGuard } from "@/components/app/RoleGuard";
import { Topbar } from "@/components/app/Topbar";

export const Route = createFileRoute("/c/$slug/_app/accounts")({
  component: () => (
      <RoleGuard allow={["manager"]} permission="nav.accounts">
      <AccountsLayout />
    </RoleGuard>
  ),
  head: () => ({ meta: [{ title: "Accounts — Smart Work Flow" }] }),
});

function AccountsLayout() {
  const tabs = [
    { to: "/c/$slug/accounts/income", label: "Income" },
    { to: "/c/$slug/accounts/expenses", label: "Expenses" },
    { to: "/c/$slug/accounts/book", label: "Accounts" },
  ] as const;
  return (
    <>
      <Topbar title="Accounts" subtitle="Money received, money spent and where it sits" />
      <div className="px-6 pt-4 flex items-center gap-2 border-b border-glass-border">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="px-4 py-2 text-sm font-medium rounded-t-lg text-muted-foreground hover:text-foreground transition"
            activeProps={{ className: "px-4 py-2 text-sm font-medium rounded-t-lg text-foreground bg-white/5 border-b-2 border-primary" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="p-6">
        <Outlet />
      </div>
    </>
  );
}