import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStockItems } from "@/hooks/use-stock-items";
import { useStockLocations } from "@/hooks/use-stock-settings";
import { useProjects } from "@/hooks/use-projects";
import { MOVEMENT_META, type MovementType, type StockMovementInput } from "@/hooks/use-stock-movements";
import { todayLocalDate } from "@/lib/format";
import { toast } from "sonner";

export function StockMovementDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: StockMovementInput) => Promise<boolean>;
}) {
  const { items } = useStockItems();
  const { rows: locations } = useStockLocations();
  const { projects } = useProjects();
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<StockMovementInput>({
    item_id: "",
    location_id: null,
    to_location_id: null,
    movement_type: "out",
    quantity: 1,
    rate: 0,
    project_id: null,
    note: "",
    moved_on: todayLocalDate(),
  });

  useEffect(() => {
    if (!open) return;
    setV({
      item_id: "",
      location_id: locations[0]?.id ?? null,
      to_location_id: null,
      movement_type: "out",
      quantity: 1,
      rate: 0,
      project_id: null,
      note: "",
      moved_on: todayLocalDate(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<StockMovementInput>) => setV((p) => ({ ...p, ...patch }));

  function pickItem(id: string) {
    const it = items.find((i) => i.id === id);
    set({ item_id: id, rate: it?.purchase_rate ?? 0 });
  }

  async function save() {
    if (!v.item_id) {
      toast.error("Pick an item");
      return;
    }
    if (v.movement_type === "adjust") {
      if (v.quantity === 0) {
        toast.error("Adjustment quantity cannot be zero");
        return;
      }
    } else if (v.quantity <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    setSaving(true);
    const ok = await onSubmit(v);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">New stock movement</DialogTitle>
          <DialogDescription>Issue material to a project, transfer between stores, or correct a count.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 py-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Item</Label>
            <Select value={v.item_id || "none"} onValueChange={(val) => (val === "none" ? set({ item_id: "" }) : pickItem(val))}>
              <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select item</SelectItem>
                {items.filter((i) => i.is_active).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={v.movement_type} onValueChange={(val) => set({ movement_type: val as MovementType })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MOVEMENT_META) as MovementType[]).map((m) => (
                  <SelectItem key={m} value={m}>{MOVEMENT_META[m].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input type="date" value={v.moved_on} onChange={(e) => set({ moved_on: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>{v.movement_type === "transfer" ? "From store" : "Store"}</Label>
            <Select value={v.location_id ?? "none"} onValueChange={(val) => set({ location_id: val === "none" ? null : val })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No store</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {v.movement_type === "transfer" && (
            <div className="grid gap-2">
              <Label>To store</Label>
              <Select value={v.to_location_id ?? "none"} onValueChange={(val) => set({ to_location_id: val === "none" ? null : val })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No store</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Quantity</Label>
            <Input type="number" value={v.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Rate (₹)</Label>
            <Input type="number" value={v.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Project (optional)</Label>
            <Select value={v.project_id ?? "none"} onValueChange={(val) => set({ project_id: val === "none" ? null : val })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Note</Label>
            <Textarea value={v.note} onChange={(e) => set({ note: e.target.value })} rows={2} className="bg-input border-border" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !v.item_id || v.quantity <= 0} className="bg-gradient-primary text-white shadow-glow">
            {saving ? "Saving…" : "Record movement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
