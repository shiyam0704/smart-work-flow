import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeLine, type LineItemInput } from "@/lib/invoice-calc";
import { formatINR } from "@/lib/format";
import { useTaxRates, useUnits } from "@/hooks/use-invoice-settings";
import { useStockItems } from "@/hooks/use-stock-items";

export function emptyLine(gstPercent = 18): LineItemInput {
  return {
    description: "",
    hsn_sac: "",
    unit: "Nos",
    quantity: 1,
    rate: 0,
    discount_percent: 0,
    gst_percent: gstPercent,
    item_id: null,
  };
}

interface Props {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
  defaultGst?: number;
}

export function LineItemsEditor({ items, onChange, defaultGst = 18 }: Props) {
  const { rates } = useTaxRates();
  const { units } = useUnits();
  const { items: stockItems } = useStockItems();
  const activeStock = stockItems.filter((i) => i.is_active);
  const gstOptions = rates.length ? rates.map((r) => r.percent) : [0, 5, 12, 18, 28];
  const unitOptions = units.length ? units.map((u) => u.name) : ["Nos", "Hrs", "Pcs"];

  const patch = (idx: number, p: Partial<LineItemInput>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));

  const pickStock = (idx: number, stockId: string) => {
    const s = activeStock.find((i) => i.id === stockId);
    if (!s) return;
    const cur = items[idx];
    const defaultRate = s.selling_rate > 0 ? s.selling_rate : Number(s.purchase_rate || 0);
    patch(idx, {
      item_id: s.id,
      description: cur?.description?.trim() ? cur.description : s.name,
      unit: s.unit || cur?.unit || "Nos",
      rate: cur?.rate ? cur.rate : defaultRate,
    });
  };

  return (
    <div className="space-y-3">
      <div className="hidden md:grid grid-cols-[160px_1fr_100px_90px_90px_80px_90px_110px_36px] gap-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>Stock item</span>
        <span>Description</span><span>HSN/SAC</span><span>Qty</span><span>Unit</span>
        <span>Rate</span><span>Disc %</span><span>GST %</span><span />
      </div>

      {items.map((it, idx) => {
        const computed = computeLine(it);
        return (
          <div
            key={idx}
            className="grid grid-cols-2 md:grid-cols-[160px_1fr_100px_90px_90px_80px_90px_110px_36px] gap-2 items-center rounded-xl border border-glass-border p-2 md:p-0 md:border-0"
          >
            <Select
              value={it.item_id ?? "none"}
              onValueChange={(v) => (v === "none" ? patch(idx, { item_id: null }) : pickStock(idx, v))}
            >
              <SelectTrigger className="col-span-2 md:col-span-1">
                <SelectValue placeholder="Stock item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No stock item</SelectItem>
                {activeStock.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.code ? ` (${s.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              className="col-span-2 md:col-span-1"
              placeholder="Item / service description"
              value={it.description}
              onChange={(e) => patch(idx, { description: e.target.value })}
            />
            <Input
              placeholder="HSN/SAC"
              value={it.hsn_sac}
              onChange={(e) => patch(idx, { hsn_sac: e.target.value })}
            />
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="Qty"
              value={it.quantity === 0 && it.quantity !== undefined ? "" : it.quantity}
              onChange={(e) => patch(idx, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
            <Select value={it.unit || unitOptions[0]} onValueChange={(v) => patch(idx, { unit: v })}>
              <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="Rate"
              value={it.rate === 0 && it.rate !== undefined ? "" : it.rate}
              onChange={(e) => patch(idx, { rate: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="any"
              placeholder="Disc %"
              value={it.discount_percent === 0 && it.discount_percent !== undefined ? "" : it.discount_percent}
              onChange={(e) => {
                const num = e.target.value === "" ? 0 : Number(e.target.value);
                patch(idx, { discount_percent: Math.min(100, Math.max(0, num)) });
              }}
            />
            <Select
              value={String(it.gst_percent)}
              onValueChange={(v) => patch(idx, { gst_percent: Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="GST" /></SelectTrigger>
              <SelectContent>
                {gstOptions.map((g) => <SelectItem key={g} value={String(g)}>{g}%</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between md:justify-end gap-2 col-span-2 md:col-span-1">
              <span className="md:hidden text-sm font-medium">{formatINR(computed.line_total)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove item"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, emptyLine(defaultGst)])}>
        <Plus className="w-4 h-4 mr-1" /> Add item
      </Button>

      {items.some((i) => i.item_id) && (
        <p className="text-[11px] text-muted-foreground">
          Stock is not reduced automatically. Record the goods going out under Stock → Movements.
        </p>
      )}
    </div>
  );
}
