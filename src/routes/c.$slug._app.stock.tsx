import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { RoleGuard } from "@/components/app/RoleGuard";
import { Topbar } from "@/components/app/Topbar";

export const Route = createFileRoute("/c/$slug/_app/stock")({
  component: () => (
    <RoleGuard allow={["manager", "executive"]} permission="nav.stock">
      <StockLayout />
    </RoleGuard>
  ),
  head: () => ({
    meta: [
      { title: "Stock — Smart Work Flow" },
      { name: "description", content: "Track items, stock balance per store and every stock movement." },
      { property: "og:title", content: "Stock — Smart Work Flow" },
      { property: "og:description", content: "Track items, stock balance per store and every stock movement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StockLayout() {
  const tabs = [
    { to: "/c/$slug/stock/balance", label: "Stock Balance" },
    { to: "/c/$slug/stock/items", label: "Items" },
    { to: "/c/$slug/stock/movements", label: "Movements" },
  ] as const;
  return (
    <>
      <Topbar title="Stock" subtitle="Items, balance per store and movement history" />
      <div className="px-4 sm:px-6 pt-4 flex items-center gap-2 border-b border-glass-border overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="px-4 py-2 text-sm font-medium rounded-t-lg text-muted-foreground hover:text-foreground transition whitespace-nowrap"
            activeProps={{ className: "px-4 py-2 text-sm font-medium rounded-t-lg text-foreground bg-white/5 border-b-2 border-primary whitespace-nowrap" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
    </>
  );
}
