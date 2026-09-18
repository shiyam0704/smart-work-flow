import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStockLocations } from "@/hooks/use-stock-settings";
import { useStockItems } from "@/hooks/use-stock-items";

import { formatINR } from "@/lib/format";
import type { PurchaseOrderRow } from "@/hooks/use-purchase-orders";

interface Line {
  po_item_id: string;
  item_id: string | null;
  description: string;
  unit: string;
  ordered: number;
  already: number;
  quantity: number;
  rate: number;
}

const today = () => new Date().toLocaleDateString("en-CA");

export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  order,
  onReceive,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: PurchaseOrderRow | null;
  onReceive: (
    order: PurchaseOrderRow,
    input: {
      receipt_date: string;
      bill_no: string;
      bill_date: string | null;
      location_id: string | null;
      notes: string;
      lines: { po_item_id: string; item_id: string | null; description: string; quantity: number; rate: number }[];
    },
  ) => Promise<boolean>;
}) {
  const { rows: locations } = useStockLocations();
  const { items: stockItems } = useStockItems();
  const stockNames = useMemo(
    () => new Map(stockItems.map((i) => [i.id, i.name] as const)),
    [stockItems],
  );

  const [saving, setSaving] = useState(false);
  const [receiptDate, setReceiptDate] = useState(today());
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState<string>("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!open || !order) return;
    setReceiptDate(today());
    setBillNo("");
    setBillDate("");
    setNotes("");
    setLocationId(order.location_id ?? locations[0]?.id ?? null);
    setLines(
      order.items.map((i) => ({
        po_item_id: i.id ?? "",
        item_id: i.item_id,
        description: i.description,
        unit: i.unit,
        ordered: i.quantity,
        already: i.received_quantity,
        quantity: Math.max(0, i.quantity - i.received_quantity),
        rate: i.rate,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.rate, 0), [lines]);

  const setLine = (idx: number, patch: Partial<Line>) =>
    setLines((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  async function save() {
    if (!order) return;
    setSaving(true);
    const ok = await onReceive(order, {
      receipt_date: receiptDate,
      bill_no: billNo.trim(),
      bill_date: billDate || null,
      location_id: locationId,
      notes,
      lines: lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({ po_item_id: l.po_item_id, item_id: l.item_id, description: l.description, quantity: l.quantity, rate: l.rate })),
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Receive goods {order ? `· ${order.po_no}` : ""}</DialogTitle>
          <DialogDescription>Entering received quantities adds them to stock and to the supplier balance.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-4 py-2">
          <div className="grid gap-2">
            <Label>Received on</Label>
            <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Supplier bill no.</Label>
            <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Bill date</Label>
            <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Store</Label>
            <Select value={locationId ?? "none"} onValueChange={(v) => setLocationId(v === "none" ? null : v)}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No store</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((l, idx) => {
            const remaining = Math.max(0, l.ordered - l.already);
            const stockName = l.item_id ? stockNames.get(l.item_id) : null;
            return (
            <div key={l.po_item_id || idx} className="grid gap-2 md:grid-cols-12 items-end p-3 rounded-lg bg-muted/30 border border-border">
              <div className="md:col-span-6">
                <p className="text-sm font-medium">{l.description || "Item"}</p>
                <p className="text-[11px] text-muted-foreground">
                  Ordered {l.ordered} {l.unit} · already received {l.already} · remaining {remaining}
                </p>
                {stockName ? (
                  <p className="text-[11px] text-success">Updates stock: {stockName}</p>
                ) : (
                  <p className="text-[11px] text-warning">No stock item linked — will not update stock</p>
                )}
              </div>
              <div className="md:col-span-3 grid gap-1">
                <Label className="text-[11px]">Receiving now</Label>
                <Input
                  type="number"
                  min={0}
                  max={remaining}
                  value={l.quantity}
                  onChange={(e) => setLine(idx, { quantity: Math.min(remaining, Math.max(0, Number(e.target.value))) })}
                  className="bg-input border-border"
                />
              </div>
              <div className="md:col-span-3 grid gap-1">
                <Label className="text-[11px]">Rate</Label>
                <Input type="number" value={l.rate} onChange={(e) => setLine(idx, { rate: Number(e.target.value) })} className="bg-input border-border" />
              </div>
            </div>
            );
          })}
        </div>


        <div className="grid gap-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-input border-border" />
        </div>

        <div className="flex justify-between text-sm font-semibold">
          <span>Receipt value</span>
          <span>{formatINR(total)}</span>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || total <= 0} className="bg-gradient-primary text-white shadow-glow">
            {saving ? "Saving…" : "Receive goods"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
