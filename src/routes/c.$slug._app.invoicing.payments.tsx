import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer, Trash2, Download, IndianRupee, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/app/confirm-dialog";
import { RecordPaymentDialog } from "@/components/invoicing/RecordPaymentDialog";
import { useInvoicePayments, type InvoicePaymentRow } from "@/hooks/use-invoice-payments";
import { useInvoices } from "@/hooks/use-invoices";
import { PAYMENT_MODES } from "@/hooks/use-project-payments";
import { usePrintBrand } from "@/hooks/use-print-brand";
import { buildReceiptHtml, printHtml } from "@/lib/invoice-print";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { toast } from "sonner";
import { useCanManage } from "@/hooks/use-permissions";

export const Route = createFileRoute("/c/$slug/_app/invoicing/payments")({
  component: PaymentsPage,
});

const modeLabel = (m: string) => PAYMENT_MODES.find((x) => x.value === m)?.label ?? m;

function PaymentsPage() {
  const { all: payments, loading, deletePayment, paidFor } = useInvoicePayments();
  const canManage = useCanManage("invoicing");
  const { all: invoices } = useInvoices();
  const { brand, receiptPrintOptions } = usePrintBrand();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);

  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      const inv = invoiceById.get(p.invoice_id);
      if (from && p.paid_on < from) return false;
      if (to && p.paid_on > to) return false;
      if (!q) return true;
      return [p.receipt_no, p.reference_no, p.note, inv?.invoice_no ?? "", inv?.bill_to_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [payments, invoiceById, query, from, to]);

  const total = rows.reduce((s, p) => s + p.amount, 0);

  function handlePrint(p: InvoicePaymentRow) {
    const inv = invoiceById.get(p.invoice_id);
    const html = buildReceiptHtml(
      {
        receiptNo: p.receipt_no || "Receipt",
        paidOn: p.paid_on,
        amount: p.amount,
        mode: modeLabel(p.mode),
        referenceNo: p.reference_no,
        note: p.note,
        receivedFrom: inv?.bill_to_name ?? "—",
        invoiceNo: inv?.invoice_no ?? "—",
        invoiceTotal: inv?.grand_total ?? 0,
        paidTillNow: inv ? paidFor(inv.id) : p.amount,
      },
      brand,
      receiptPrintOptions,
    );
    if (!printHtml(html)) toast.error("Allow pop-ups to print this receipt");
  }

  async function handleDelete(p: InvoicePaymentRow) {
    const ok = await confirm({
      title: "Delete payment?",
      description: `${p.receipt_no || "This payment"} will be removed and the invoice balance updated.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deletePayment(p.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          placeholder="Search receipts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:w-40" aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="sm:w-40" aria-label="To date" />
        <div className="flex gap-2 sm:ml-auto">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv("invoice-payments", rows, [
                { key: "receipt", label: "Receipt No", value: (r) => r.receipt_no },
                { key: "date", label: "Paid On", value: (r) => r.paid_on },
                { key: "invoice", label: "Invoice", value: (r) => invoiceById.get(r.invoice_id)?.invoice_no ?? "" },
                { key: "client", label: "Received From", value: (r) => invoiceById.get(r.invoice_id)?.bill_to_name ?? "" },
                { key: "amount", label: "Amount", value: (r) => r.amount },
                { key: "mode", label: "Mode", value: (r) => modeLabel(r.mode) },
                { key: "ref", label: "Reference", value: (r) => r.reference_no },
              ])
            }
          >
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button onClick={() => setOpen(true)} disabled={!canManage}>
            <IndianRupee className="w-4 h-4 mr-1" /> Record payment
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Total received (filtered)</div>
        <div className="text-xl font-display font-bold mt-1">{formatINR(total)}</div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading payments…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <Wallet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">No payments recorded</p>
          <p className="text-sm text-muted-foreground">Record a payment against an invoice to generate a receipt.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-glass-border">
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const inv = invoiceById.get(p.invoice_id);
                return (
                  <tr key={p.id} className="border-b border-glass-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{p.receipt_no || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.paid_on, "d MMM yyyy")}</td>
                    <td className="px-4 py-3">
                      <div>{inv?.invoice_no ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{inv?.bill_to_name ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {modeLabel(p.mode)}
                      {p.reference_no && <div className="text-xs text-muted-foreground">{p.reference_no}</div>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatINR(p.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Print receipt" onClick={() => handlePrint(p)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete payment" disabled={!canManage} onClick={() => handleDelete(p)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RecordPaymentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
