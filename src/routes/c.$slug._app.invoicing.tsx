import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { RoleGuard } from "@/components/app/RoleGuard";
import { Topbar } from "@/components/app/Topbar";

export const Route = createFileRoute("/c/$slug/_app/invoicing")({
  component: () => (
    <RoleGuard allow={["manager"]} permission="nav.invoicing">
      <InvoicingLayout />
    </RoleGuard>
  ),
  head: () => ({
    meta: [
      { title: "Invoicing — Smart Work Flow" },
      { name: "description", content: "Create quotations, raise GST invoices and record payments." },
      { property: "og:title", content: "Invoicing — Smart Work Flow" },
      { property: "og:description", content: "Create quotations, raise GST invoices and record payments." },
    ],
  }),
});

function InvoicingLayout() {
  const tabs = [
    { to: "/c/$slug/invoicing/quotations", label: "Quotations" },
    { to: "/c/$slug/invoicing/invoices", label: "Invoices" },
    { to: "/c/$slug/invoicing/pending", label: "Pending" },
  ] as const;
  return (
    <>
      <Topbar title="Invoicing" subtitle="Quotations, invoices and payment receipts" />
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
