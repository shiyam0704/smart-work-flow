import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { RoleGuard } from "@/components/app/RoleGuard";
import { Topbar } from "@/components/app/Topbar";

export const Route = createFileRoute("/c/$slug/_app/purchase")({
  component: () => (
    <RoleGuard allow={["manager"]} permission="nav.purchase">
      <PurchaseLayout />
    </RoleGuard>
  ),
  head: () => ({
    meta: [
      { title: "Purchase — Smart Work Flow" },
      { name: "description", content: "Manage suppliers, raise purchase orders, receive goods and record supplier payments." },
      { property: "og:title", content: "Purchase — Smart Work Flow" },
      { property: "og:description", content: "Manage suppliers, raise purchase orders, receive goods and record supplier payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PurchaseLayout() {
  const tabs = [
    { to: "/c/$slug/purchase/orders", label: "Purchase Orders" },
    { to: "/c/$slug/purchase/suppliers", label: "Suppliers" },
    { to: "/c/$slug/purchase/pending", label: "Supplier Pending" },
  ] as const;
  return (
    <>
      <Topbar title="Purchase" subtitle="Suppliers, purchase orders and supplier payments" />
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
