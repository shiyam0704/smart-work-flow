import { useState, useMemo } from "react";
import { useHasPermission } from "@/hooks/use-permissions";
import { Plus, Trash2, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  useProjectPayments,
  PAYMENT_MODES,
  type PaymentMode,
} from "@/hooks/use-project-payments";
import { useConfirm } from "@/components/app/confirm-dialog";
import { AccountPicker } from "@/components/accounts/AccountPicker";
import { lastUsedAccount, rememberAccount } from "@/hooks/use-payment-accounts";
import { formatINR, todayLocalDate } from "@/lib/format";

interface Props {
  projectId: string;
  finalPrice: number | null;
  quotedPrice: number | null;
}

function todayStr() {
  return todayLocalDate();
}

function modeLabel(m: string) {
  return PAYMENT_MODES.find((x) => x.value === m)?.label ?? m;
}

function computeBadge(price: number | null, total: number) {
  if (price === null) {
    return total > 0
      ? { label: `Advance ${formatINR(total)}`, cls: "bg-info/20 text-info border-info/30" }
      : { label: "No price set", cls: "bg-muted text-muted-foreground border-border" };
  }
  if (total >= price && total === price) {
    return { label: "Paid", cls: "bg-success/20 text-success border-success/30" };
  }
  if (total > price) {
    return { label: `Overpaid ${formatINR(total - price)}`, cls: "bg-warning/20 text-warning border-warning/30" };
  }
  const due = price - total;
  return { label: `Due ${formatINR(due)}`, cls: "bg-destructive/20 text-destructive border-destructive/30" };
}

export function PaymentsButton({ projectId, finalPrice, quotedPrice }: Props) {
  const { canViewFinancials } = useAuth();
  const isManager = useHasPermission("manage.accounts");
  const { payments, total, addPayment, deletePayment } = useProjectPayments(projectId);
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayStr());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState<string | null>(lastUsedAccount());
  const [saving, setSaving] = useState(false);

  const price = finalPrice ?? quotedPrice;
  const badge = useMemo(() => computeBadge(price, total), [price, total]);

  if (!canViewFinancials) return null;


  const reset = () => {
    setAmount("");
    setPaidOn(todayStr());
    setMode("cash");
    setDescription("");
    setAccountId(lastUsedAccount());
  };

  const submit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) return;
    setSaving(true);
    const ok = await addPayment({
      project_id: projectId,
      amount: num,
      paid_on: paidOn,
      description: description.trim(),
      mode,
      account_id: accountId,
    });
    setSaving(false);
    if (ok) {
      rememberAccount(accountId);
      reset();
      setAddOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`glass border h-9 gap-2 ${badge.cls}`}
            title="Payment details"
          >
            <IndianRupee className="w-4 h-4" />
            <span className="font-semibold">{badge.label}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-background border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <IndianRupee className="w-5 h-5" /> Payments
            </DialogTitle>
            <DialogDescription>
              <span className="text-muted-foreground">Price: </span>
              <span className="text-foreground font-medium">{price !== null ? formatINR(price) : "—"}</span>
              <span className="text-muted-foreground"> · Collected: </span>
              <span className="text-foreground font-medium">{formatINR(total)}</span>
              <span className={`ml-2 px-2 py-0.5 rounded-md text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isManager && (
              <div className="flex justify-end">
                <Button onClick={() => setAddOpen(true)} className="bg-gradient-primary text-white shadow-glow">
                  <Plus className="w-4 h-4" /> Add Payment
                </Button>
              </div>
            )}

            {payments.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6 glass rounded-xl">
                No payments recorded yet.
              </div>
            ) : (
              <div className="glass rounded-xl divide-y divide-glass-border overflow-hidden max-h-[50vh] overflow-y-auto">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="font-medium w-24">{formatINR(p.amount)}</div>
                    <div className="text-muted-foreground w-28">{p.paid_on}</div>
                    <div className="text-xs px-2 py-0.5 rounded bg-white/10 text-muted-foreground">
                      {modeLabel(p.mode)}
                    </div>
                    <div className="flex-1 text-muted-foreground truncate">{p.description || "—"}</div>
                    {isManager && (
                      <button
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "Delete payment?",
                              description: `Remove the ${formatINR(p.amount)} payment from ${p.paid_on}.`,
                            })
                          )
                            deletePayment(p.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete payment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) reset(); }}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Record payment</DialogTitle>
            <DialogDescription>Log an advance, milestone, or final payment.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-input border-border"
                  placeholder="5000"
                />
              </div>
              <div className="grid gap-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className="bg-input border-border"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AccountPicker value={accountId} onChange={setAccountId} label="Received into" />
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 50% advance, milestone 1…"
                className="bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={saving || !amount || Number(amount) <= 0}
              className="bg-gradient-primary text-white shadow-glow"
            >
              {saving ? "Saving…" : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Backwards-compatible alias
export const PaymentsCard = PaymentsButton;
