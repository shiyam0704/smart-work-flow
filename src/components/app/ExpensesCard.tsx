import { useState } from "react";
import { useHasPermission } from "@/hooks/use-permissions";
import { Receipt, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EditExpenseModal } from "@/components/app/EditExpenseModal";
import { useConfirm } from "@/components/app/confirm-dialog";
import { useExpenses } from "@/hooks/use-expenses";
import { useAuth } from "@/hooks/use-auth";
import { PAYMENT_MODES } from "@/hooks/use-project-payments";
import { formatINR } from "@/lib/format";

function modeLabel(m: string) {
  return PAYMENT_MODES.find((x) => x.value === m)?.label ?? m;
}

interface Props {
  projectId: string;
  clientId?: string | null;
}

/** Project-level expenses summary + quick add, mirroring PaymentsButton. */
export function ExpensesButton({ projectId, clientId }: Props) {
  const { canViewFinancials } = useAuth();
  const isManager = useHasPermission("manage.expenses");
  const { expenses, total, deleteExpense } = useExpenses({ projectId });
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (!canViewFinancials) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="glass border-glass-border">
            <Receipt className="w-4 h-4" /> Expenses
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">{formatINR(total)}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project expenses</DialogTitle>
            <DialogDescription>
              Total spent on this project: <span className="font-semibold">{formatINR(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="glass rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.spent_on} · {e.category || "—"} · {modeLabel(e.mode)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold tabular-nums">{formatINR(e.amount)}</span>
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete expense"
                      className="text-destructive"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Delete expense?",
                          description: `${e.title} · ${formatINR(e.amount)}`,
                          confirmText: "Delete",
                        });
                        if (ok) await deleteExpense(e.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No expenses recorded for this project yet.
              </div>
            )}
          </div>

          {isManager && (
            <Button onClick={() => setAddOpen(true)} className="w-full">
              <Plus className="w-4 h-4" /> Add expense
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <EditExpenseModal
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultProjectId={projectId}
        defaultClientId={clientId ?? null}
      />
    </>
  );
}