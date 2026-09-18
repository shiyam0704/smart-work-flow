import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, AlertTriangle, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordPaymentDialog } from "@/components/invoicing/RecordPaymentDialog";
import { useInvoices } from "@/hooks/use-invoices";
import { useInvoicePayments } from "@/hooks/use-invoice-payments";
import { useProjects } from "@/hooks/use-projects";
import { invoiceDisplayStatus, DOC_STATUS_META } from "@/lib/invoice-calc";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { useCanManage } from "@/hooks/use-permissions";
import { RoleGuard } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/c/$slug/_app/invoicing/pending")({
  component: () => (
    <RoleGuard permission={["nav.invoicing.pending", "nav.invoicing"]}>
      <InvoicePendingPage />
    </RoleGuard>
  ),

  head: () => ({
    meta: [
      { title: "Pending — Invoicing" },
      { name: "description", content: "Invoices still unpaid or part paid, with balance due per customer." },
    ],
  }),
});

const ALL = "all";

function InvoicePendingPage() {
  const { all: invoices, loading } = useInvoices();
  const { paidFor } = useInvoicePayments();
  const { projects } = useProjects();
  const canManage = useCanManage("invoicing");

  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState(ALL);
  const [payFor, setPayFor] = useState<string | null>(null);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices
      .filter((i) => i.status !== "cancelled" && i.status !== "draft")
      .map((i) => {
        const paid = paidFor(i.id);
        return {
          ...i,
          paid,
          balance: i.grand_total - paid,
          display: invoiceDisplayStatus(i.status, i.grand_total, paid, i.due_date),
          projectName: i.project_id ? projectById.get(i.project_id)?.name ?? "" : "",
        };
      })
      .filter((r) => r.balance > 0.5)
      .filter((r) => (projectId === ALL ? true : projectId === "none" ? !r.project_id : r.project_id === projectId))
      .filter((r) => (!q ? true : [r.invoice_no, r.bill_to_name, r.title, r.projectName].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => b.balance - a.balance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, paidFor, projectById, query, projectId]);

  const kpi = useMemo(() => {
    const billed = rows.reduce((s, r) => s + r.grand_total, 0);
    const received = rows.reduce((s, r) => s + r.paid, 0);
    return { billed, received, balance: billed - received, count: rows.length };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Billed (pending invoices)" value={formatINR(kpi.billed)} />
        <Kpi label="Received so far" value={formatINR(kpi.received)} />
        <Kpi label="Balance due" value={formatINR(kpi.balance)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input placeholder="Search customer or invoice…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All projects</SelectItem>
            <SelectItem value="none">Not linked to a project</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="sm:ml-auto"
          disabled={rows.length === 0}
          onClick={() =>
            exportRowsAsCsv("invoice-pending", rows, [
              { key: "no", label: "Invoice No", value: (r) => r.invoice_no },
              { key: "date", label: "Date", value: (r) => r.invoice_date },
              { key: "due", label: "Due Date", value: (r) => r.due_date ?? "" },
              { key: "client", label: "Bill To", value: (r) => r.bill_to_name },
              { key: "project", label: "Project", value: (r) => r.projectName },
              { key: "total", label: "Billed", value: (r) => r.grand_total },
              { key: "paid", label: "Received", value: (r) => r.paid },
              { key: "balance", label: "Balance", value: (r) => r.balance },
            ])
          }
        >
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">{loading ? "Loading…" : "Nothing pending"}</p>
          <p className="text-sm text-muted-foreground">Every sent invoice is fully paid.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-glass-border">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Bill to</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Billed</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = DOC_STATUS_META[r.display];
                return (
                  <tr key={r.id} className="border-b border-glass-border/60 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {r.invoice_no}
                      <div className="text-xs text-muted-foreground">{formatDate(r.invoice_date, "d MMM yyyy")}</div>
                    </td>
                    <td className="px-4 py-3">{r.bill_to_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.projectName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full border text-xs whitespace-nowrap", meta?.cls)}>
                        {meta?.label ?? r.display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatINR(r.grand_total)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(r.paid)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neon-pink">{formatINR(r.balance)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" aria-label="Record payment" disabled={!canManage} onClick={() => setPayFor(r.id)}>
                        <IndianRupee className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RecordPaymentDialog
        open={payFor !== null}
        onOpenChange={(o) => { if (!o) setPayFor(null); }}
        invoiceId={payFor || undefined}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}
