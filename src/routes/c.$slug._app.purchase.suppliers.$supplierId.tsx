import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Download, Plus } from "lucide-react";
import { CLink as Link } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { SupplierPaymentDialog } from "@/components/purchase/SupplierPaymentDialog";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useSupplierBalances, useSupplierPayments } from "@/hooks/use-supplier-payments";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";

export const Route = createFileRoute("/c/$slug/_app/purchase/suppliers/$supplierId")({
  component: SupplierDetailPage,
});

function SupplierDetailPage() {
  const params = useParams({ strict: false }) as { supplierId?: string };
  const supplierId = params.supplierId ?? "";
  const { suppliers } = useSuppliers();
  const { balances, statementFor, loading } = useSupplierBalances();
  const { addPayment } = useSupplierPayments();
  const [open, setOpen] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const balance = balances.find((b) => b.supplier.id === supplierId);
  const lines = supplierId ? statementFor(supplierId) : [];

  if (!supplier) {
    return (
      <div className="space-y-4">
        <Link to="/c/$slug/purchase/suppliers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All suppliers
        </Link>
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {loading ? "Loading…" : "Supplier not found."}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Opening balance", value: balance?.opening ?? 0 },
    { label: "Goods received", value: balance?.billed ?? 0 },
    { label: "Paid", value: balance?.paid ?? 0 },
    { label: "Outstanding", value: balance?.outstanding ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Link to="/c/$slug/purchase/suppliers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All suppliers
        </Link>
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv(
                `${supplier.name}-statement`,
                lines.map((l) => ({
                  Date: l.date,
                  Particulars: l.label,
                  Reference: l.reference,
                  Debit: l.debit,
                  Credit: l.credit,
                  Balance: l.balance,
                })),
              )
            }
          >
            <Download className="w-4 h-4" /> Statement CSV
          </Button>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-white shadow-glow">
            <Plus className="w-4 h-4" /> Record payment
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-display font-bold text-lg">{supplier.name}</h2>
        <p className="text-sm text-muted-foreground">
          {[supplier.contact_person, supplier.phone, supplier.email, supplier.city].filter(Boolean).join(" · ") || "No contact details"}
        </p>
        {supplier.gstin ? <p className="text-xs text-muted-foreground mt-1">GST {supplier.gstin}</p> : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="font-display font-bold text-lg mt-1">{formatINR(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h3 className="font-display font-semibold">Statement</h3>
        </div>
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b border-glass-border">
          <div className="col-span-2">Date</div>
          <div className="col-span-4">Particulars</div>
          <div className="col-span-2 text-right">Debit</div>
          <div className="col-span-2 text-right">Credit</div>
          <div className="col-span-2 text-right">Balance</div>
        </div>
        {lines.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          lines.map((l, i) => (
            <div key={`${l.date}-${i}`} className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-3 px-4 py-3 border-b border-glass-border last:border-0 text-sm">
              <div className="md:col-span-2 text-muted-foreground">{formatDate(l.date)}</div>
              <div className="md:col-span-4">
                {l.label}
                {l.reference ? <span className="text-muted-foreground"> · {l.reference}</span> : null}
              </div>
              <div className="md:col-span-2 md:text-right">{l.debit ? formatINR(l.debit) : "—"}</div>
              <div className="md:col-span-2 md:text-right">{l.credit ? formatINR(l.credit) : "—"}</div>
              <div className="md:col-span-2 md:text-right font-semibold">{formatINR(l.balance)}</div>
            </div>
          ))
        )}
      </div>

      <SupplierPaymentDialog open={open} onOpenChange={setOpen} supplierId={supplierId} onSubmit={addPayment} />
    </div>
  );
}
