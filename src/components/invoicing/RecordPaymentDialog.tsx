import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_MODES, type PaymentMode } from "@/hooks/use-project-payments";
import { useInvoicePayments } from "@/hooks/use-invoice-payments";
import { useInvoices } from "@/hooks/use-invoices";
import { formatINR, todayLocalDate, isFutureLocalDate } from "@/lib/format";
import { AccountPicker } from "@/components/accounts/AccountPicker";
import { lastUsedAccount, rememberAccount } from "@/hooks/use-payment-accounts";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string;
}

export function RecordPaymentDialog({ open, onOpenChange, invoiceId }: Props) {
  const { all: invoices } = useInvoices();
  const { addPayment, paidFor } = useInvoicePayments();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string>(invoiceId ?? "");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayLocalDate());
  const [mode, setMode] = useState<PaymentMode>("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);

  const openInvoices = useMemo(
    () =>
      invoices.filter((i) => {
        if (i.status === "cancelled" || i.status === "draft") return false;
        const due = i.grand_total - paidFor(i.id);
        return due > 0.01 || i.id === invoiceId;
      }),
    [invoices, paidFor, invoiceId],
  );
  const invoice = invoices.find((i) => i.id === selected);
  const balance = invoice ? Math.max(0, invoice.grand_total - paidFor(invoice.id)) : 0;

  useEffect(() => {
    if (!open) return;
    const id = invoiceId ?? "";
    setSelected(id);
    setPaidOn(todayLocalDate());
    setMode("bank_transfer");
    setReference("");
    setNote("");
    setAmount("");
    setAccountId(lastUsedAccount());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  useEffect(() => {
    if (!invoice) return;
    setAmount(String(Math.max(0, Number((invoice.grand_total - paidFor(invoice.id)).toFixed(2)))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function handleSave() {
    if (!selected || !invoice) { toast.error("Pick an invoice"); return; }
    if (invoice.status === "cancelled" || invoice.status === "draft") {
      toast.error(`Cannot record payment against a ${invoice.status} invoice`);
      return;
    }
    const value = Number(amount);
    if (!value || isNaN(value) || value <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }
    if (value > balance + 0.01) {
      toast.error(`Payment cannot exceed invoice balance (${formatINR(balance)})`);
      return;
    }
    if (isFutureLocalDate(paidOn)) {
      toast.error("Payment date cannot be in the future");
      return;
    }
    setSaving(true);
    const id = await addPayment({
      invoice_id: selected,
      amount: value,
      paid_on: paidOn,
      mode,
      reference_no: reference,
      note,
      account_id: accountId,
    });
    setSaving(false);
    if (id) { rememberAccount(accountId); onOpenChange(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            A receipt number is generated automatically for every payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!invoiceId && (
            <div className="space-y-1.5">
              <Label>Invoice</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {openInvoices.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoice_no} · {i.bill_to_name} · {formatINR(i.grand_total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {invoice && (
            <div className="rounded-xl border border-glass-border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice total</span><span>{formatINR(invoice.grand_total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Balance due</span><span className="font-medium">{formatINR(balance)}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Paid on</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(m) => setMode(m as PaymentMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference no.</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
            </div>
            <AccountPicker value={accountId} onChange={setAccountId} label="Received into" className="col-span-2" />
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
