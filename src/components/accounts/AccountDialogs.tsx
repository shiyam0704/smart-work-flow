import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCOUNT_TYPES,
  usePaymentAccounts,
  useAccountTransfers,
  type AccountType,
  type PaymentAccountInput,
  type PaymentAccountRow,
} from "@/hooks/use-payment-accounts";

const today = () => new Date().toLocaleDateString("en-CA");

const emptyAccount = (): PaymentAccountInput => ({
  name: "",
  account_type: "cash",
  bank_name: "",
  account_no: "",
  ifsc: "",
  holder_name: "",
  opening_balance: 0,
  opening_date: today(),
  is_active: true,
  notes: "",
});

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account?: PaymentAccountRow | null;
}) {
  const { addAccount, updateAccount } = usePaymentAccounts();
  const [v, setV] = useState<PaymentAccountInput>(emptyAccount());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (account) {
      setV({
        name: account.name,
        account_type: account.account_type,
        bank_name: account.bank_name ?? "",
        account_no: account.account_no ?? "",
        ifsc: account.ifsc ?? "",
        holder_name: account.holder_name ?? "",
        opening_balance: account.opening_balance,
        opening_date: account.opening_date,
        is_active: account.is_active,
        notes: account.notes ?? "",
      });
    } else {
      setV(emptyAccount());
    }
  }, [open, account?.id]);

  const set = (patch: Partial<PaymentAccountInput>) => setV((p) => ({ ...p, ...patch }));
  const isBank = v.account_type === "bank" || v.account_type === "upi";

  async function save() {
    if (!v.name.trim()) return;
    setSaving(true);
    const ok = account ? await updateAccount(account.id, v) : await addAccount(v);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            Cash box, bank account or wallet that money moves in and out of.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 py-1">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Name</Label>
            <Input value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Cash box, HDFC Current" />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={v.account_type} onValueChange={(t) => set({ account_type: t as AccountType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Holder name</Label>
            <Input value={v.holder_name} onChange={(e) => set({ holder_name: e.target.value })} />
          </div>

          {isBank && (
            <>
              <div className="grid gap-2">
                <Label>Bank</Label>
                <Input value={v.bank_name} onChange={(e) => set({ bank_name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Account / UPI ID</Label>
                <Input value={v.account_no} onChange={(e) => set({ account_no: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>IFSC</Label>
                <Input value={v.ifsc} onChange={(e) => set({ ifsc: e.target.value })} />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label>Opening balance (₹)</Label>
            <Input
              type="number"
              step="any"
              value={v.opening_balance}
              onChange={(e) => set({ opening_balance: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Opening date</Label>
            <Input
              type="date"
              value={v.opening_date ?? ""}
              onChange={(e) => set({ opening_date: e.target.value || null })}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          <div className="flex items-center justify-between sm:col-span-2 rounded-xl border border-glass-border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive accounts stay in history but can't be picked.</div>
            </div>
            <Switch checked={v.is_active} onCheckedChange={(c) => set({ is_active: c })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !v.name.trim()}>
            {saving ? "Saving…" : account ? "Save changes" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransferDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { activeAccounts } = usePaymentAccounts();
  const { addTransfer } = useAccountTransfers();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom("");
    setTo("");
    setAmount("");
    setDate(today());
    setReference("");
    setNote("");
  }, [open]);

  const valid = from && to && from !== to && Number(amount) > 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const ok = await addTransfer({
      from_account_id: from,
      to_account_id: to,
      transfer_date: date,
      amount: Number(amount),
      reference_no: reference.trim(),
      note: note.trim(),
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
          <DialogDescription>
            Moving your own money — it is not counted as income or expense.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>From</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>To</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.filter((a) => a.id !== from).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Amount (₹)</Label>
            <Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Reference no.</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || saving}>{saving ? "Saving…" : "Record transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
