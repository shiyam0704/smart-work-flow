import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/app/confirm-dialog";
import { SupplierPaymentDialog } from "@/components/purchase/SupplierPaymentDialog";
import { useSupplierPayments, useSupplierBalances, type SupplierPaymentRow } from "@/hooks/use-supplier-payments";
import { useSuppliers } from "@/hooks/use-suppliers";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { usePrintBrand } from "@/hooks/use-print-brand";
import { buildReceiptHtml, printHtml } from "@/lib/invoice-print";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { toast } from "sonner";
import { useCanManage } from "@/hooks/use-permissions";

export const Route = createFileRoute("/c/$slug/_app/purchase/payments")({
  component: SupplierPaymentsPage,
});

const ALL = "all";

function SupplierPaymentsPage() {
  const { payments, loading, addPayment, deletePayment } = useSupplierPayments();
  const canManage = useCanManage("purchase");
  const { suppliers } = useSuppliers();
  const { orders } = usePurchaseOrders();
  const { balances } = useSupplierBalances();
  const { brand, printOptions } = usePrintBrand();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState<string>(ALL);
  const [open, setOpen] = useState(false);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (supplier !== ALL && p.supplier_id !== supplier) return false;
      if (!q) return true;
      return [p.voucher_no, supplierName(p.supplier_id), p.reference_no, p.note].join(" ").toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, query, supplier, suppliers]);

  const total = rows.reduce((s, p) => s + p.amount, 0);

  function handlePrint(p: SupplierPaymentRow) {
    const bal = balances.find((b) => b.supplier.id === p.supplier_id);
    const po = orders.find((o) => o.id === p.purchase_order_id);
    const html = buildReceiptHtml(
      {
        receiptNo: p.voucher_no,
        date: p.paid_on,
        receivedFrom: supplierName(p.supplier_id),
        invoiceNo: po?.po_no ?? "",
        invoiceTotal: po?.grand_total ?? bal?.billed ?? 0,
        paidTillNow: bal?.paid ?? p.amount,
        amount: p.amount,
        mode: p.mode,
        referenceNo: p.reference_no,
        note: p.note,
        headingLabel: "Payment Voucher",
        partyLabel: "Paid To",
        refLabel: "Against Purchase Order",
        totalLabel: po ? "Order Total" : "Total Billed",
        paidLabel: "Total Paid",
        balanceLabel: "Balance Due",
      } as any,
      brand,
      printOptions,
    );
    if (!printHtml(html)) toast.error("Allow pop-ups to print this voucher");
  }

  async function handleDelete(p: SupplierPaymentRow) {
    const ok = await confirm({
      title: "Delete payment?",
      description: `${p.voucher_no} will be removed and the supplier balance recalculated.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deletePayment(p.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative sm:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search payments…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 bg-input border-border" />
        </div>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="sm:w-56 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All suppliers</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv(
                "supplier-payments",
                rows.map((p) => ({
                  Voucher: p.voucher_no,
                  Date: p.paid_on,
                  Supplier: supplierName(p.supplier_id),
                  Amount: p.amount,
                  Mode: p.mode,
                  Reference: p.reference_no,
                  Note: p.note,
                })),
              )
            }
          >
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-white shadow-glow" disabled={!canManage}>
            <Plus className="w-4 h-4" /> New payment
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Payments shown</span>
        <span className="font-display font-bold text-lg">{formatINR(total)}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No supplier payments yet.</div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b border-glass-border">
            <div className="col-span-2">Voucher</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Supplier</div>
            <div className="col-span-2">Mode</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-1" />
          </div>
          {rows.map((p) => (
            <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3 border-b border-glass-border last:border-0 items-center">
              <div className="md:col-span-2 font-medium">{p.voucher_no}</div>
              <div className="md:col-span-2 text-sm text-muted-foreground">{formatDate(p.paid_on)}</div>
              <div className="md:col-span-3 text-sm truncate">{supplierName(p.supplier_id)}</div>
              <div className="md:col-span-2 text-sm capitalize">{p.mode}</div>
              <div className="md:col-span-2 md:text-right font-semibold text-sm">{formatINR(p.amount)}</div>
              <div className="md:col-span-1 flex md:justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label="Print voucher" onClick={() => handlePrint(p)}>
                  <Printer className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete payment" disabled={!canManage} onClick={() => handleDelete(p)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SupplierPaymentDialog open={open} onOpenChange={setOpen} onSubmit={addPayment} />
    </div>
  );
}
