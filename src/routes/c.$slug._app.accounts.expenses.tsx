import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { Download, Plus, Receipt, Tag, TrendingDown, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/app/RoleGuard";
import { EditExpenseModal } from "@/components/app/EditExpenseModal";
import { useConfirm } from "@/components/app/confirm-dialog";
import { useExpenseCategories, useExpenses, type ExpenseRow } from "@/hooks/use-expenses";
import { PAYMENT_MODES } from "@/hooks/use-project-payments";
import { useProjects } from "@/hooks/use-projects";
import { useClientsData } from "@/hooks/use-clients-data";
import { formatINR } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { useCanManage } from "@/hooks/use-permissions";
import { usePaymentAccounts } from "@/hooks/use-payment-accounts";

export const Route = createFileRoute("/c/$slug/_app/accounts/expenses")({
  component: () => (
    <RoleGuard allow={["manager"]} permission="nav.expenses">
      <ExpensesPage />
    </RoleGuard>
  ),
  head: () => ({
    meta: [
      { title: "Expenses — Smart Work Flow" },
      { name: "description", content: "Record company expenses and link them to clients and projects." },
      { property: "og:title", content: "Expenses — Smart Work Flow" },
      { property: "og:description", content: "Record company expenses and link them to clients and projects." },
    ],
  }),
});

const ALL = "all";

function modeLabel(m: string) {
  return PAYMENT_MODES.find((x) => x.value === m)?.label ?? m;
}

function ExpensesPage() {
  const { expenses, loading, deleteExpense } = useExpenses();
  const canManage = useCanManage("expenses");
  const { nameFor } = usePaymentAccounts();
  const accountNameFor = (id: string | null) => (id ? nameFor(id) || "—" : "Unassigned");
  const { names: categoryNames } = useExpenseCategories();
  const { projects } = useProjects();
  const { clients } = useClientsData();
  const confirm = useConfirm();

  const [category, setCategory] = useState(ALL);
  const [clientId, setClientId] = useState(ALL);
  const [projectId, setProjectId] = useState(ALL);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses
      .map((e) => ({
        e,
        project: e.project_id ? projectById.get(e.project_id) : undefined,
        client: e.client_id ? clientById.get(e.client_id) : undefined,
      }))
      .filter(({ e, project, client }) => {
        const itemCategories = (e.items ?? []).map((i) => i.category);
        if (
          category !== ALL &&
          e.category !== category &&
          !itemCategories.includes(category)
        ) return false;
        if (clientId !== ALL && e.client_id !== clientId) return false;
        if (projectId !== ALL && e.project_id !== projectId) return false;
        if (from && e.spent_on < from) return false;
        if (to && e.spent_on > to) return false;
        if (q) {
          const hay = [
            e.title,
            e.note,
            e.category,
            ...(e.items ?? []).flatMap((i) => [i.description, i.category]),
            project?.name ?? "",
            client?.name ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [expenses, projectById, clientById, category, clientId, projectId, from, to, query]);

  const kpi = useMemo(() => {
    const total = rows.reduce((s, r) => {
      if (category !== ALL) {
        const matching = (r.e.items ?? []).filter((i) => i.category === category);
        if (matching.length > 0) {
          return s + matching.reduce((sub, it) => sub + it.amount, 0);
        }
        if (r.e.category === category) return s + r.e.amount;
        return s;
      }
      return s + r.e.amount;
    }, 0);
    const byCategory = new Map<string, number>();
    for (const r of rows) {
      for (const it of r.e.items ?? []) {
        const key = it.category || "—";
        byCategory.set(key, (byCategory.get(key) ?? 0) + it.amount);
      }
    }
    let topCategory = "—";
    let topAmount = 0;
    for (const [k, v] of byCategory) if (v > topAmount) { topCategory = k; topAmount = v; }
    return { total, count: rows.length, topCategory, topAmount };
  }, [rows, category]);

  function onExport() {
    exportRowsAsCsv("expenses", rows, [
      { key: "date", label: "Date", value: (r) => r.e.spent_on },
      { key: "title", label: "Title", value: (r) => r.e.title },
      { key: "category", label: "Category", value: (r) => r.e.category },
      { key: "items", label: "Items", value: (r) => (r.e.items ?? []).length },
      { key: "client", label: "Client", value: (r) => r.client?.name ?? "" },
      { key: "project", label: "Project", value: (r) => r.project?.name ?? "" },
      { key: "mode", label: "Paid via", value: (r) => modeLabel(r.e.mode) },
      { key: "account", label: "Account", value: (r) => accountNameFor(r.e.account_id) },
      { key: "amount", label: "Amount", value: (r) => r.e.amount },
      { key: "note", label: "Note", value: (r) => r.e.note },
    ]);
  }

  function onExportItems() {
    const itemRows = rows.flatMap(({ e, project, client }) =>
      (e.items ?? []).map((it) => ({ e, it, project, client })),
    );
    exportRowsAsCsv("expense-items", itemRows, [
      { key: "date", label: "Date", value: (r) => r.e.spent_on },
      { key: "entry", label: "Entry", value: (r) => r.e.title },
      { key: "item", label: "Item", value: (r) => r.it.description },
      { key: "category", label: "Category", value: (r) => r.it.category },
      { key: "qty", label: "Qty", value: (r) => r.it.quantity },
      { key: "rate", label: "Rate", value: (r) => r.it.rate },
      { key: "amount", label: "Amount", value: (r) => r.it.amount },
      { key: "client", label: "Client", value: (r) => r.client?.name ?? "" },
      { key: "project", label: "Project", value: (r) => r.project?.name ?? "" },
      { key: "mode", label: "Paid via", value: (r) => modeLabel(r.e.mode) },
    ]);
  }


  async function onDelete(row: ExpenseRow) {
    const ok = await confirm({
      title: "Delete expense?",
      description: `${row.title} · ${formatINR(row.amount)} will be removed permanently.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteExpense(row.id);
  }

  return (
    <>
      
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Kpi icon={TrendingDown} label="Total expenses" value={formatINR(kpi.total)} />
          <Kpi icon={Receipt} label="Entries" value={kpi.count.toString()} />
          <Kpi
            icon={Tag}
            label="Top category"
            value={kpi.topCategory}
            meta={kpi.topAmount ? formatINR(kpi.topAmount) : undefined}
          />
        </div>

        <div className="glass rounded-2xl p-4 shadow-card flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[170px]">
            <label className="text-xs text-muted-foreground">Client</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All clients</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[170px]">
            <label className="text-xs text-muted-foreground">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Search</label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, note, client…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={onExport} disabled={rows.length === 0}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={onExportItems} disabled={rows.length === 0}>
            <Download className="w-4 h-4" /> Export items
          </Button>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} disabled={!canManage}>
            <Plus className="w-4 h-4" /> New expense
          </Button>
        </div>

        {/* Desktop table */}
        <div className="glass rounded-2xl shadow-card overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Paid via</th>
                <th className="text-left px-4 py-3">Account</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, project, client }) => {
                const items = e.items ?? [];
                const multi = items.length > 1;
                const open = !!expanded[e.id];
                return (
                  <Fragment key={e.id}>
                    <tr className="border-t border-glass-border hover:bg-white/5">

                      <td className="px-4 py-3 whitespace-nowrap">{e.spent_on}</td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span>{e.title}</span>
                          {multi && (
                            <button
                              type="button"
                              onClick={() => setExpanded((p) => ({ ...p, [e.id]: !open }))}
                              className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              {items.length} items
                              <ChevronDown className={`w-3 h-3 transition ${open ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.category || "—"}</td>
                      <td className="px-4 py-3">{client?.name ?? "—"}</td>
                      <td className="px-4 py-3">{project?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{modeLabel(e.mode)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{accountNameFor(e.account_id)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatINR(e.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit expense"
                            disabled={!canManage} onClick={() => { setEditing(e); setModalOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete expense"
                            className="text-destructive" disabled={!canManage} onClick={() => onDelete(e)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {multi && open && (
                      <tr key={`${e.id}-items`} className="border-t border-glass-border bg-white/[0.03]">
                        <td />
                        <td colSpan={8} className="px-4 py-3">
                          <div className="space-y-1">
                            {items.map((it) => (
                              <div key={it.id} className="flex items-center gap-3 text-xs">
                                <span className="flex-1 truncate">{it.description || "—"}</span>
                                <span className="text-muted-foreground">{it.category || "—"}</span>
                                <span className="text-muted-foreground tabular-nums">
                                  {it.quantity} × {formatINR(it.rate)}
                                </span>
                                <span className="font-semibold tabular-nums w-24 text-right">
                                  {formatINR(it.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>

                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  {loading ? "Loading…" : "No expenses match the current filters."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {rows.map(({ e, project, client }) => {
            const items = e.items ?? [];
            const multi = items.length > 1;
            const open = !!expanded[e.id];
            return (
              <div key={e.id} className="glass rounded-2xl p-4 shadow-card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.spent_on} · {e.category || "—"}</div>
                  </div>
                  <div className="font-semibold whitespace-nowrap">{formatINR(e.amount)}</div>
                </div>
                {multi && (
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [e.id]: !open }))}
                    className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {items.length} items
                    <ChevronDown className={`w-3 h-3 transition ${open ? "rotate-180" : ""}`} />
                  </button>
                )}
                {multi && open && (
                  <div className="space-y-1 pt-1">
                    {items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">
                          {it.description || "—"}
                          <span className="text-muted-foreground"> · {it.category || "—"}</span>
                        </span>
                        <span className="font-semibold tabular-nums whitespace-nowrap">{formatINR(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground truncate">
                  {client?.name ?? "No client"} · {project?.name ?? "No project"} · {modeLabel(e.mode)}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(e); setModalOpen(true); }} disabled={!canManage}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => onDelete(e)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
              {loading ? "Loading…" : "No expenses yet."}
            </div>
          )}
        </div>
      </div>

      <EditExpenseModal open={modalOpen} onOpenChange={setModalOpen} expense={editing} />
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold truncate">{value}</div>
        {meta && <div className="text-[11px] text-muted-foreground">{meta}</div>}
      </div>
    </div>
  );
}