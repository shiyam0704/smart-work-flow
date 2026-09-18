import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_MODES } from "@/hooks/use-project-payments";
import {
  useExpenseCategories,
  useExpenses,
  type ExpenseInput,
  type ExpenseItemInput,
  type ExpenseMode,
  type ExpenseRow,
} from "@/hooks/use-expenses";
import { useProjects } from "@/hooks/use-projects";
import { useClientsData } from "@/hooks/use-clients-data";
import { AccountPicker } from "@/components/accounts/AccountPicker";
import { usePaymentAccounts, lastUsedAccount, rememberAccount } from "@/hooks/use-payment-accounts";
import { formatINR, todayLocalDate } from "@/lib/format";

const NONE = "none";

function todayStr() {
  return todayLocalDate();
}

interface ItemDraft {
  key: string;
  description: string;
  category: string;
  quantity: string;
  rate: string;
}

let keySeq = 0;
function newItem(category = ""): ItemDraft {
  keySeq += 1;
  return { key: `item-${keySeq}`, description: "", category, quantity: "1", rate: "" };
}

function lineAmount(it: ItemDraft) {
  const q = Number(it.quantity);
  const r = Number(it.rate);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return 0;
  return Math.round(q * r * 100) / 100;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Existing row to edit; omit for a new expense. */
  expense?: ExpenseRow | null;
  /** Pre-selected links for a new expense. */
  defaultProjectId?: string | null;
  defaultClientId?: string | null;
}

export function EditExpenseModal({
  open,
  onOpenChange,
  expense,
  defaultProjectId,
  defaultClientId,
}: Props) {
  const { addExpense, updateExpense } = useExpenses();
  const { names: categoryNames, addCategory } = useExpenseCategories();
  const { projects } = useProjects();
  const { clients } = useClientsData();
  const { activeAccounts } = usePaymentAccounts();

  const [title, setTitle] = useState("");
  const [spentOn, setSpentOn] = useState(todayStr());
  const [mode, setMode] = useState<ExpenseMode>("cash");
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState<string>(NONE);
  const [projectId, setProjectId] = useState<string>(NONE);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const firstCategory = categoryNames[0] ?? "";
    if (expense) {
      setTitle(expense.title);
      setSpentOn(expense.spent_on);
      setMode(expense.mode);
      setNote(expense.note);
      setClientId(expense.client_id ?? NONE);
      setProjectId(expense.project_id ?? NONE);
      const isKnown = expense.account_id && activeAccounts.some((a) => a.id === expense.account_id);
      setAccountId(isKnown ? expense.account_id : null);
      const drafts = (expense.items ?? []).map((it) => {
        keySeq += 1;
        return {
          key: `item-${keySeq}`,
          description: it.description,
          category: it.category,
          quantity: String(it.quantity),
          rate: String(it.rate),
        };
      });
      setItems(drafts.length ? drafts : [newItem(firstCategory)]);
    } else {
      setTitle("");
      setSpentOn(todayStr());
      setMode("cash");
      setNote("");
      setItems([newItem(firstCategory)]);
      setProjectId(defaultProjectId ?? NONE);
      const last = lastUsedAccount(activeAccounts);
      setAccountId(last && activeAccounts.some((a) => a.id === last) ? last : null);
      const inferred =
        defaultClientId ??
        (defaultProjectId ? projects.find((p) => p.id === defaultProjectId)?.client_id ?? null : null);
      setClientId(inferred ?? NONE);
    }
    setNewCategory("");
    setAddingCategory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  // Projects are filtered by the selected client so the two links stay coherent.
  const visibleProjects = useMemo(
    () => (clientId === NONE ? projects : projects.filter((p) => p.client_id === clientId)),
    [projects, clientId],
  );

  const onSelectProject = (v: string) => {
    setProjectId(v);
    if (v === NONE) return;
    const proj = projects.find((p) => p.id === v);
    if (proj?.client_id) setClientId(proj.client_id);
  };

  const onSelectClient = (v: string) => {
    setClientId(v);
    if (v === NONE) return;
    const proj = projects.find((p) => p.id === projectId);
    if (proj && proj.client_id !== v) setProjectId(NONE);
  };

  const patchItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const total = useMemo(
    () => Math.round(items.reduce((s, it) => s + lineAmount(it), 0) * 100) / 100,
    [items],
  );

  const canSave = total > 0 && !!title.trim() && !!spentOn;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const itemPayload: ExpenseItemInput[] = items
      .filter((it) => lineAmount(it) > 0 || it.description.trim())
      .map((it) => ({
        description: it.description.trim() || title.trim(),
        category: it.category.trim(),
        quantity: Number(it.quantity) || 0,
        rate: Number(it.rate) || 0,
        amount: lineAmount(it),
      }));

    const categories = Array.from(new Set(itemPayload.map((i) => i.category).filter(Boolean)));
    const safeAccountId =
      accountId && activeAccounts.some((a) => a.id === accountId) ? accountId : null;
    const payload: ExpenseInput = {
      title: title.trim(),
      amount: total,
      spent_on: spentOn,
      category: categories.length > 1 ? "Multiple" : categories[0] ?? "",
      mode,
      note: note.trim(),
      client_id: clientId === NONE ? null : clientId,
      project_id: projectId === NONE ? null : projectId,
      account_id: safeAccountId,
    };
    const ok = expense
      ? await updateExpense(expense.id, payload, itemPayload)
      : await addExpense(payload, itemPayload);
    setSaving(false);
    if (ok) {
      rememberAccount(safeAccountId);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "New expense"}</DialogTitle>
          <DialogDescription>
            Add one or more items to this entry. Linking a client or project is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-title">Title</Label>
              <Input
                id="exp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Site purchase — Chennai"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>
            </div>

            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.key}
                  className="rounded-xl border border-glass-border p-3 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
                    <Input
                      value={it.description}
                      onChange={(e) => patchItem(it.key, { description: e.target.value })}
                      placeholder="Item / product"
                      aria-label="Item description"
                    />
                    <Select
                      value={it.category || undefined}
                      onValueChange={(v) => patchItem(it.key, { category: v })}
                    >
                      <SelectTrigger aria-label="Item category">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryNames.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={it.quantity}
                      onChange={(e) => patchItem(it.key, { quantity: e.target.value })}
                      placeholder="Qty"
                      aria-label="Quantity"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.rate}
                      onChange={(e) => patchItem(it.key, { rate: e.target.value })}
                      placeholder="Price"
                      aria-label="Price"
                    />
                    <div className="text-sm font-semibold tabular-nums whitespace-nowrap px-1">
                      {formatINR(lineAmount(it))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      className="text-destructive"
                      disabled={items.length === 1}
                      onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      newItem(prev[prev.length - 1]?.category ?? categoryNames[0] ?? ""),
                    ])
                  }
                >
                  <Plus className="w-3.5 h-3.5" /> Add item
                </Button>
                {addingCategory ? (
                  <div className="flex gap-2">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="New category"
                      className="h-9 w-[150px]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        const name = newCategory.trim();
                        if (!name) return;
                        const ok = await addCategory(name);
                        if (ok) {
                          setNewCategory("");
                          setAddingCategory(false);
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    onClick={() => setAddingCategory(true)}
                  >
                    <Plus className="w-3 h-3" /> Add category
                  </button>
                )}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground mr-2">Total</span>
                <span className="font-semibold tabular-nums">{formatINR(total)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Paid via</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ExpenseMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Client (optional)</Label>
              <Select value={clientId} onValueChange={onSelectClient}>
                <SelectTrigger>
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={onSelectProject}>
                <SelectTrigger>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No project</SelectItem>
                  {visibleProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AccountPicker value={accountId} onChange={setAccountId} label="Paid from" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-note">Notes</Label>
            <Textarea
              id="exp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optional details, bill number, vendor…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving…" : expense ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
