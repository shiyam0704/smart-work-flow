import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Download, Search, Printer, CheckCircle2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/app/confirm-dialog";
import { PurchaseOrderFormDialog } from "@/components/purchase/PurchaseOrderFormDialog";
import { ReceiveGoodsDialog } from "@/components/purchase/ReceiveGoodsDialog";
import { usePurchaseOrders, PO_STATUS_META, type POStatus, type PurchaseOrderRow } from "@/hooks/use-purchase-orders";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useStockSettings } from "@/hooks/use-stock-settings";
import { usePrintBrand } from "@/hooks/use-print-brand";
import { useStockItems } from "@/hooks/use-stock-items";
import { buildDocumentHtml, printHtml, recompute } from "@/lib/invoice-print";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCanManage } from "@/hooks/use-permissions";

export const Route = createFileRoute("/c/$slug/_app/purchase/orders")({
  component: PurchaseOrdersPage,
});

const ALL = "all";

function PurchaseOrdersPage() {
  const { orders, loading, createOrder, updateOrder, approveOrder, deleteOrder, receiveOrder } = usePurchaseOrders();
  const canManage = useCanManage("purchase");
  const { suppliers } = useSuppliers();
  const { settings } = useStockSettings();
  const { brand, printOptions } = usePrintBrand();
  const { items: stockItems } = useStockItems();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrderRow | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrderRow | null>(null);

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== ALL && o.status !== status) return false;
      if (!q) return true;
      return [o.po_no, supplierName(o.supplier_id), o.notes].join(" ").toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, query, status, suppliers]);

  function stockLabel(itemId: string | null, description: string) {
    const name = itemId ? stockItems.find((s) => s.id === itemId)?.name : null;
    if (!name || description.toLowerCase().includes(name.toLowerCase())) return description;
    return description ? `${description} (${name})` : name;
  }

  function handlePrint(o: PurchaseOrderRow) {
    const { lines, totals, taxGroups } = recompute(
      o.items.map((i) => ({
        description: stockLabel(i.item_id, i.description),
        hsn_sac: "",
        unit: i.unit,
        quantity: i.quantity,
        rate: i.rate,
        discount_percent: i.discount_percent,
        gst_percent: i.gst_percent,
      })) as any,
      o.is_interstate,
    );
    const supplier = suppliers.find((s) => s.id === o.supplier_id);
    const html = buildDocumentHtml(
      {
        kind: "Purchase Order",
        number: o.po_no,
        date: o.po_date,
        secondaryLabel: "Expected on",
        secondaryValue: o.expected_date ?? undefined,
        title: "",
        billToName: supplier?.name ?? "",
        billToAddress: supplier?.address ?? "",
        billToGstin: supplier?.gstin ?? "",
        billToContactPerson: supplier?.contact_person ?? "",
        billToContactNumber: supplier?.phone ?? "",
        placeOfSupply: supplier?.city ?? "",
        isInterstate: o.is_interstate,
        items: lines,
        totals,
        taxGroups,
        notes: o.notes,
        terms: o.terms,
      },
      brand,
      { ...printOptions, paperSize: settings?.paper_size ?? printOptions.paperSize, template: settings?.print_template ?? printOptions.template },
    );
    if (!printHtml(html)) toast.error("Allow pop-ups to print this purchase order");
  }

  async function handleDelete(o: PurchaseOrderRow) {
    const ok = await confirm({
      title: "Delete purchase order?",
      description: `${o.po_no} and its items will be permanently removed.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteOrder(o.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative sm:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search orders…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 bg-input border-border" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {(Object.keys(PO_STATUS_META) as POStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{PO_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv(
                "purchase-orders",
                rows.map((o) => ({
                  "PO No": o.po_no,
                  Date: o.po_date,
                  Supplier: supplierName(o.supplier_id),
                  Status: PO_STATUS_META[o.status].label,
                  Total: o.grand_total,
                })),
              )
            }
          >
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-gradient-primary text-white shadow-glow" disabled={!canManage}>
            <Plus className="w-4 h-4" /> New order
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No purchase orders yet.</div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b border-glass-border">
            <div className="col-span-2">PO no.</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Supplier</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-2" />
          </div>
          {rows.map((o) => (
            <div key={o.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3 border-b border-glass-border last:border-0 items-center">
              <div className="md:col-span-2 font-medium">{o.po_no}</div>
              <div className="md:col-span-2 text-sm text-muted-foreground">{formatDate(o.po_date)}</div>
              <div className="md:col-span-3 text-sm truncate">{supplierName(o.supplier_id)}</div>
              <div className="md:col-span-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border", PO_STATUS_META[o.status].cls)}>
                  {PO_STATUS_META[o.status].label}
                </span>
              </div>
              <div className="md:col-span-1 md:text-right font-semibold text-sm">{formatINR(o.grand_total)}</div>
              <div className="md:col-span-2 flex md:justify-end gap-1">
                {(o.status === "pending_approval" || o.status === "draft") && (
                  <Button variant="ghost" size="icon" aria-label="Approve order" disabled={!canManage} onClick={() => approveOrder(o.id)}>
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </Button>
                )}
                {o.status !== "cancelled" && o.status !== "received" && (
                  <Button variant="ghost" size="icon" aria-label="Receive goods" disabled={!canManage} onClick={() => setReceiving(o)}>
                    <PackageCheck className="w-4 h-4 text-info" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label="Print order" onClick={() => handlePrint(o)}>
                  <Printer className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Edit order" disabled={!canManage} onClick={() => { setEditing(o); setFormOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete order" disabled={!canManage} onClick={() => handleDelete(o)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PurchaseOrderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        order={editing}
        onSubmit={async (v) => (editing ? await updateOrder(editing.id, v) : Boolean(await createOrder(v)))}
      />
      <ReceiveGoodsDialog
        open={Boolean(receiving)}
        onOpenChange={(o) => { if (!o) setReceiving(null); }}
        order={receiving}
        onReceive={receiveOrder}
      />
    </div>
  );
}
