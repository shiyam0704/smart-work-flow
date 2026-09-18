import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { Plus, ArrowLeftRight, Wallet, Pencil, Trash2, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useConfirm } from "@/components/app/confirm-dialog";
import { AccountFormDialog, TransferDialog } from "@/components/accounts/AccountDialogs";
import {
  usePaymentAccounts,
  accountTypeLabel,
  type PaymentAccountRow,
} from "@/hooks/use-payment-accounts";
import { useAccountBook } from "@/hooks/use-money-flow";
import { useHasAnyPermission } from "@/hooks/use-permissions";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";

export const Route = createFileRoute("/c/$slug/_app/accounts/book")({
  component: () => (
    <RoleGuard permission={["nav.accounts.book", "nav.accounts"]}>
      <AccountBookPage />
    </RoleGuard>
  ),
  head: () => ({
    meta: [
      { title: "Accounts book — Cash & bank" },
      { name: "description", content: "Every cash box, bank account and wallet with its live balance." },
    ],
  }),
});

function AccountBookPage() {
  const { accounts, loading, deleteAccount } = usePaymentAccounts();
  const { balances, unassigned, statementFor, totalBalance } = useAccountBook();
  const canManage = useHasAnyPermission(["manage.accounts.book", "manage.accounts"]);
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentAccountRow | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [openAccount, setOpenAccount] = useState<string | null>(null);

  const totals = useMemo(() => {
    const received = balances.reduce((s, b) => s + b.received, 0);
    const spent = balances.reduce((s, b) => s + b.spent, 0);
    return { received, spent };
  }, [balances]);

  async function onDelete(a: PaymentAccountRow) {
    const ok = await confirm({
      title: "Delete account?",
      description: `${a.name} will be removed. Entries already linked to it stay, but show as unassigned.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteAccount(a.id);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Balance on hand" value={formatINR(totalBalance)} />
        <Kpi label="Money in" value={formatINR(totals.received)} />
        <Kpi label="Money out" value={formatINR(totals.spent)} />
      </div>

      <div className="glass rounded-2xl p-4 shadow-card flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] text-sm text-muted-foreground">
          Track where money sits — cash box, bank accounts and wallets.
        </div>
        <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={!canManage || accounts.length < 2}>
          <ArrowLeftRight className="w-4 h-4" /> Transfer
        </Button>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!canManage}>
          <Plus className="w-4 h-4" /> New account
        </Button>
      </div>

      {unassigned.count > 0 && (
        <div className="glass rounded-2xl p-4 shadow-card text-sm">
          <span className="font-medium">{unassigned.count} older entries are not linked to an account.</span>{" "}
          <span className="text-muted-foreground">
            {formatINR(unassigned.received)} in and {formatINR(unassigned.spent)} out. Edit an entry to assign it.
          </span>
        </div>
      )}

      <div className="glass rounded-2xl shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Account</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Opening</th>
              <th className="text-right px-4 py-3">In</th>
              <th className="text-right px-4 py-3">Out</th>
              <th className="text-right px-4 py-3">Balance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => {
              const open = openAccount === b.account.id;
              const lines = open ? statementFor(b.account.id) : [];
              return (
                <Fragment key={b.account.id}>
                  <tr className="border-t border-glass-border hover:bg-white/5">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 font-medium"
                        onClick={() => setOpenAccount(open ? null : b.account.id)}
                      >
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        {b.account.name}
                        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? "rotate-180" : ""}`} />
                      </button>
                      {!b.account.is_active && (
                        <span className="ml-2 text-[10px] uppercase font-semibold text-muted-foreground">Inactive</span>
                      )}
                      {b.account.bank_name && (
                        <div className="text-xs text-muted-foreground">
                          {b.account.bank_name}
                          {b.account.account_no ? ` · ${b.account.account_no}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{accountTypeLabel(b.account.account_type)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatINR(b.opening)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">{formatINR(b.received + b.transferIn)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">{formatINR(b.spent + b.transferOut)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatINR(b.balance)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit account" disabled={!canManage}
                          onClick={() => { setEditing(b.account); setFormOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete account" className="text-destructive"
                          disabled={!canManage} onClick={() => onDelete(b.account)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-t border-glass-border bg-white/[0.03]">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Statement</div>
                          <Button variant="outline" size="sm" disabled={lines.length === 0}
                            onClick={() =>
                              exportRowsAsCsv(`account-${b.account.name}`, lines, [
                                { key: "date", label: "Date", value: (l) => l.date },
                                { key: "label", label: "Entry", value: (l) => l.label },
                                { key: "detail", label: "Details", value: (l) => l.detail },
                                { key: "in", label: "In", value: (l) => l.inAmount },
                                { key: "out", label: "Out", value: (l) => l.outAmount },
                                { key: "balance", label: "Balance", value: (l) => l.balance },
                              ])
                            }
                          >
                            <Download className="w-3.5 h-3.5" /> Export
                          </Button>
                        </div>
                        {lines.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-3">No movements in this account yet.</div>
                        ) : (
                          <div className="space-y-1">
                            {lines.map((l) => (
                              <div key={l.id} className="flex items-center gap-3 text-xs">
                                <span className="w-24 whitespace-nowrap text-muted-foreground">{formatDate(l.date, "d MMM yyyy")}</span>
                                <span className="w-36 truncate">{l.label}</span>
                                <span className="flex-1 truncate text-muted-foreground">{l.detail}</span>
                                <span className="w-24 text-right tabular-nums text-success">{l.inAmount ? formatINR(l.inAmount) : ""}</span>
                                <span className="w-24 text-right tabular-nums text-destructive">{l.outAmount ? formatINR(l.outAmount) : ""}</span>
                                <span className="w-28 text-right tabular-nums font-semibold">{formatINR(l.balance)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {balances.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                {loading ? "Loading…" : "No accounts yet. Add your cash box or bank account to start."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AccountFormDialog open={formOpen} onOpenChange={setFormOpen} account={editing} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display font-semibold text-lg">{value}</div>
    </div>
  );
}
