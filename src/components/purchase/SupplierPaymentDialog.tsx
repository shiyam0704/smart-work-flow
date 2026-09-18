import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuppliers } from "@/hooks/use-suppliers";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { SUPPLIER_PAYMENT_MODES, type SupplierPaymentInput, type SupplierPaymentMode } from "@/hooks/use-supplier-payments";
import { AccountPicker } from "@/components/accounts/AccountPicker";
import { lastUsedAccount, rememberAccount } from "@/hooks/use-payment-accounts";

const today = () => new Date().toLocaleDateString("en-CA");

export function SupplierPaymentDialog({
  open,
  onOpenChange,
  supplierId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplierId?: string | null;
  onSubmit: (v: SupplierPaymentInput) => Promise<unknown>;
}) {
  const { suppliers } = useSuppliers();
  const { orders } = usePurchaseOrders();
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<SupplierPaymentInput>({
    supplier_id: "",
    purchase_order_id: null,
    amount: 0,
    paid_on: today(),
    mode: "bank",
    reference_no: "",
    note: "",
    account_id: null,
  });

  useEffect(() => {
    if (!open) return;
    setV({
      supplier_id: supplierId ?? "",
      purchase_order_id: null,
      amount: 0,
      paid_on: today(),
      mode: "bank",
      reference_no: "",
      note: "",
      account_id: lastUsedAccount(),
    });
  }, [open, supplierId]);

  const set = (patch: Partial<SupplierPaymentInput>) => setV((p) => ({ ...p, ...patch }));
  const supplierOrders = orders.filter((o) => o.supplier_id === v.supplier_id);

  async function save() {
    if (!v.supplier_id || v.amount <= 0) return;
    setSaving(true);
    const res = await onSubmit(v);
    setSaving(false);
    if (res) { rememberAccount(v.account_id ?? null); onOpenChange(false); }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Record supplier payment</DialogTitle>
          <DialogDescription>Payments reduce the outstanding balance for that supplier.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 py-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Supplier</Label>
            <Select value={v.supplier_id || "none"} onValueChange={(val) => set({ supplier_id: val === "none" ? "" : val, purchase_order_id: null })}>
              <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select supplier</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Against purchase order (optional)</Label>
            <Select value={v.purchase_order_id ?? "none"} onValueChange={(val) => set({ purchase_order_id: val === "none" ? null : val })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific order</SelectItem>
                {supplierOrders.map((o) => <SelectItem key={o.id} value={o.id}>{o.po_no}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Amount (₹)</Label>
            <Input type="number" value={v.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Paid on</Label>
            <Input type="date" value={v.paid_on} onChange={(e) => set({ paid_on: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="grid gap-2">
            <Label>Mode</Label>
            <Select value={v.mode} onValueChange={(val) => set({ mode: val as SupplierPaymentMode })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPLIER_PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Reference no.</Label>
            <Input value={v.reference_no} onChange={(e) => set({ reference_no: e.target.value })} className="bg-input border-border" />
          </div>
          <AccountPicker
            value={v.account_id ?? null}
            onChange={(id) => set({ account_id: id })}
            label="Paid from"
            className="sm:col-span-2"
          />
          <div className="grid gap-2 sm:col-span-2">
            <Label>Note</Label>
            <Textarea value={v.note} onChange={(e) => set({ note: e.target.value })} rows={2} className="bg-input border-border" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !v.supplier_id || v.amount <= 0} className="bg-gradient-primary text-white shadow-glow">
            {saving ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
