import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { SupplierInput, SupplierRow } from "@/hooks/use-suppliers";

const empty: SupplierInput = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  gstin: "",
  opening_balance: 0,
  notes: "",
  is_active: true,
};

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier: SupplierRow | null;
  onSubmit: (v: SupplierInput) => Promise<unknown>;
}) {
  const [v, setV] = useState<SupplierInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setV(
      supplier
        ? {
            name: supplier.name,
            contact_person: supplier.contact_person,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            city: supplier.city,
            gstin: supplier.gstin,
            opening_balance: supplier.opening_balance,
            notes: supplier.notes,
            is_active: supplier.is_active,
          }
        : empty,
    );
  }, [open, supplier]);

  const set = (patch: Partial<SupplierInput>) => setV((p) => ({ ...p, ...patch }));

  async function save() {
    if (!v.name.trim()) return;
    setSaving(true);
    const res = await onSubmit({ ...v, name: v.name.trim() });
    setSaving(false);
    if (res) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{supplier ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>Suppliers you buy materials and services from.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 py-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Supplier name</Label>
            <Input value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sri Hardware Traders" className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Contact person</Label>
            <Input value={v.contact_person} onChange={(e) => set({ contact_person: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Phone</Label>
            <Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={v.email} onChange={(e) => set({ email: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>City</Label>
            <Input value={v.city} onChange={(e) => set({ city: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Address</Label>
            <Textarea value={v.address} onChange={(e) => set({ address: e.target.value })} rows={2} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>GST number</Label>
            <Input value={v.gstin} onChange={(e) => set({ gstin: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Opening balance (₹)</Label>
            <Input
              type="number"
              value={v.opening_balance}
              onChange={(e) => set({ opening_balance: Number(e.target.value) })}
              className="bg-input border-border"
            />
            <p className="text-[11px] text-muted-foreground">Amount already due to this supplier before you started using the app.</p>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className="bg-input border-border" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={v.is_active} onCheckedChange={(c) => set({ is_active: c })} id="supplier-active" />
            <Label htmlFor="supplier-active">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !v.name.trim()} className="bg-gradient-primary text-white shadow-glow">
            {saving ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
