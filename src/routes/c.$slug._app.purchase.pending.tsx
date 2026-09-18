import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLink as Link } from "@/lib/nav";
import { SupplierPaymentDialog } from "@/components/purchase/SupplierPaymentDialog";
import { useSupplierBalances, useSupplierPayments } from "@/hooks/use-supplier-payments";
import { formatINR } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { useCanManage } from "@/hooks/use-permissions";
import { RoleGuard } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/c/$slug/_app/purchase/pending")({
  component: () => (
    <RoleGuard permission={["nav.purchase.pending", "nav.purchase"]}>
      <SupplierPendingPage />
    </RoleGuard>
  ),

  head: () => ({
    meta: [
      { title: "Supplier Pending — Purchase" },
      { name: "description", content: "What is still owed to each supplier after goods received and payments made." },
    ],
  }),
});

function SupplierPendingPage() {
  const { balances } = useSupplierBalances();
  const { addPayment } = useSupplierPayments();
  const canManage = useCanManage("purchase");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return balances
      .filter((b) => Math.abs(b.outstanding) > 0.5)
      .filter((b) => (!q ? true : b.supplier.name.toLowerCase().includes(q)))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [balances, query]);

  const total = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Total payable" value={formatINR(total)} />
        <Kpi label="Suppliers pending" value={String(rows.length)} />
        <Kpi label="Total billed" value={formatINR(rows.reduce((s, r) => s + r.billed + r.opening, 0))} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input placeholder="Search supplier…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              exportRowsAsCsv("supplier-pending", rows, [
                { key: "supplier", label: "Supplier", value: (r) => r.supplier.name },
                { key: "opening", label: "Opening", value: (r) => r.opening },
                { key: "billed", label: "Billed", value: (r) => r.billed },
                { key: "paid", label: "Paid", value: (r) => r.paid },
                { key: "outstanding", label: "Outstanding", value: (r) => r.outstanding },
              ])
            }
          >
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button onClick={() => setOpen(true)} disabled={!canManage} className="bg-gradient-primary text-white shadow-glow">
            <Plus className="w-4 h-4 mr-1" /> New payment
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">No supplier dues</p>
          <p className="text-sm text-muted-foreground">All supplier bills are settled.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-glass-border">
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Opening</th>
                <th className="px-4 py-3 text-right">Billed</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-right">Statement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.supplier.id} className="border-b border-glass-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{r.supplier.name}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(r.opening)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(r.billed)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(r.paid)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-neon-pink">{formatINR(r.outstanding)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/c/$slug/purchase/suppliers/$supplierId" params={{ supplierId: r.supplier.id }}>Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SupplierPaymentDialog open={open} onOpenChange={setOpen} onSubmit={addPayment} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}
