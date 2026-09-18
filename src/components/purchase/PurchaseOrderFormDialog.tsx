import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useStockItems } from "@/hooks/use-stock-items";
import { useStockLocations, useStockSettings, useStockUnits, DEFAULT_UNITS } from "@/hooks/use-stock-settings";
import { computeDocument } from "@/lib/invoice-calc";
import { formatINR } from "@/lib/format";
import type { POStatus, PurchaseOrderInput, PurchaseOrderRow, POItemInput } from "@/hooks/use-purchase-orders";

const today = () => new Date().toLocaleDateString("en-CA");

const emptyLine = (unit: string, gst: number): POItemInput => ({
  item_id: null,
  description: "",
  unit,
  quantity: 1,
  rate: 0,
  discount_percent: 0,
  gst_percent: gst,
});

const STATUS_CHOICES: { value: POStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "ordered", label: "Ordered" },
  { value: "cancelled", label: "Cancelled" },
];

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  order,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: PurchaseOrderRow | null;
  onSubmit: (v: PurchaseOrderInput) => Promise<unknown>;
}) {
  const { suppliers } = useSuppliers();
  const { items } = useStockItems();
  const { rows: locations } = useStockLocations();
  const { rows: unitRows } = useStockUnits();
  const { settings } = useStockSettings();
  const unitNames = unitRows.length ? unitRows.map((u) => u.name) : DEFAULT_UNITS;
  const defaultGst = settings?.default_gst_percent ?? 18;

  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<PurchaseOrderInput>({
    supplier_id: null,
    po_date: today(),
    expected_date: null,
    location_id: null,
    status: "draft",
    is_interstate: false,
    notes: "",
    terms: "",
    items: [emptyLine("Nos", 18)],
  });

  useEffect(() => {
    if (!open) return;
    if (order) {
      setV({
        supplier_id: order.supplier_id,
        po_date: order.po_date,
        expected_date: order.expected_date,
        location_id: order.location_id,
        status: order.status,
        is_interstate: order.is_interstate,
        notes: order.notes,
        terms: order.terms,
        items: order.items.map((i) => ({
          id: i.id,
          item_id: i.item_id,
          description: i.description,
          unit: i.unit,
          quantity: i.quantity,
          rate: i.rate,
          discount_percent: i.discount_percent,
          gst_percent: i.gst_percent,
          received_quantity: i.received_quantity ?? 0,
        })),
      });
    } else {
      setV({
        supplier_id: null,
        po_date: today(),
        expected_date: null,
        location_id: locations.find((l) => l.is_active !== false)?.id ?? null,
        status: "draft",
        is_interstate: false,
        notes: "",
        terms: settings?.default_po_terms ?? "",
        items: [emptyLine(unitNames[0] ?? "Nos", defaultGst)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order]);

  const set = (patch: Partial<PurchaseOrderInput>) => setV((p) => ({ ...p, ...patch }));
  const setLine = (idx: number, patch: Partial<POItemInput>) =>
    setV((p) => ({ ...p, items: p.items.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));

  const totals = useMemo(
    () =>
      computeDocument(
        v.items.map((i) => ({
          description: i.description,
          hsn_sac: "",
          unit: i.unit,
          quantity: i.quantity,
          rate: i.rate,
          discount_percent: i.discount_percent,
          gst_percent: i.gst_percent,
        })),
        { isInterstate: v.is_interstate, roundOff: true },
      ).totals,
    [v.items, v.is_interstate],
  );

  function pickItem(idx: number, itemId: string) {
    const it = items.find((i) => i.id === itemId);
    setLine(idx, {
      item_id: itemId,
      description: it?.name ?? "",
      unit: it?.unit ?? "Nos",
      rate: it?.purchase_rate ?? 0,
    });
  }

  async function save() {
    const lines = v.items.filter((l) => l.description.trim() || l.item_id);
    if (!v.supplier_id || !lines.length) return;
    setSaving(true);
    const ok = await onSubmit({ ...v, items: lines });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-4xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{order ? `Edit ${order.po_no}` : "New purchase order"}</DialogTitle>
          <DialogDescription>Order materials from a supplier. Stock updates only when goods are received.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3 py-2">
          <div className="grid gap-2">
            <Label>Supplier</Label>
            <Select value={v.supplier_id ?? "none"} onValueChange={(val) => set({ supplier_id: val === "none" ? null : val })}>
              <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select supplier</SelectItem>
                {suppliers.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Order date</Label>
            <Input type="date" value={v.po_date} onChange={(e) => set({ po_date: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Expected date</Label>
            <Input type="date" value={v.expected_date ?? ""} onChange={(e) => set({ expected_date: e.target.value || null })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Deliver to store</Label>
            <Select value={v.location_id ?? "none"} onValueChange={(val) => set({ location_id: val === "none" ? null : val })}>
              <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No store</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={v.status} onValueChange={(val) => set({ status: val as POStatus })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_CHOICES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="po-interstate" checked={v.is_interstate} onCheckedChange={(c) => set({ is_interstate: c })} />
            <Label htmlFor="po-interstate">Inter-state (IGST)</Label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button variant="outline" size="sm" onClick={() => setV((p) => ({ ...p, items: [...p.items, emptyLine(unitNames[0] ?? "Nos", defaultGst)] }))}>
              <Plus className="w-4 h-4" /> Add line
            </Button>
          </div>
          {v.items.map((l, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-12 items-end p-3 rounded-lg bg-muted/30 border border-border">
              <div className="md:col-span-3 grid gap-1">
                <Label className="text-[11px]">Item</Label>
                <Select value={l.item_id ?? "none"} onValueChange={(val) => (val === "none" ? setLine(idx, { item_id: null }) : pickItem(idx, val))}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Free text" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Free text</SelectItem>
                    {items.filter((i) => i.is_active).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 grid gap-1">
                <Label className="text-[11px]">Description</Label>
                <Input value={l.description} onChange={(e) => setLine(idx, { description: e.target.value })} className="bg-input border-border" />
              </div>
              <div className="md:col-span-1 grid gap-1">
                <Label className="text-[11px]">Unit</Label>
                <Input value={l.unit} onChange={(e) => setLine(idx, { unit: e.target.value })} className="bg-input border-border" />
              </div>
              <div className="md:col-span-1 grid gap-1">
                <Label className="text-[11px]">Qty</Label>
                <Input type="number" value={l.quantity} onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} className="bg-input border-border" />
              </div>
              <div className="md:col-span-1 grid gap-1">
                <Label className="text-[11px]">Rate</Label>
                <Input type="number" value={l.rate} onChange={(e) => setLine(idx, { rate: Number(e.target.value) })} className="bg-input border-border" />
              </div>
              <div className="md:col-span-1 grid gap-1">
                <Label className="text-[11px]">Disc %</Label>
                <Input type="number" value={l.discount_percent} onChange={(e) => setLine(idx, { discount_percent: Number(e.target.value) })} className="bg-input border-border" />
              </div>
              <div className="md:col-span-1 grid gap-1">
                <Label className="text-[11px]">GST %</Label>
                <Input type="number" value={l.gst_percent} onChange={(e) => setLine(idx, { gst_percent: Number(e.target.value) })} className="bg-input border-border" />
              </div>
              <div className="md:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setV((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 pt-2">
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Terms</Label>
            <Textarea value={v.terms} onChange={(e) => set({ terms: e.target.value })} rows={3} className="bg-input border-border" />
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>{formatINR(totals.taxable_total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatINR(totals.tax_total)}</span></div>
          <div className="flex justify-between font-semibold text-base"><span>Grand total</span><span>{formatINR(totals.grand_total)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !v.supplier_id} className="bg-gradient-primary text-white shadow-glow">
            {saving ? "Saving…" : order ? "Save changes" : "Create purchase order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
