import { createFileRoute } from "@tanstack/react-router";
import { useCNavigate as useNavigate } from "@/lib/nav";
import { useMemo, useState } from "react";
import { Wallet, AlertTriangle, Percent, FolderKanban } from "lucide-react";
import { ReportShell } from "@/components/app/reports/ReportShell";
import { ReportFilters } from "@/components/app/reports/ReportFilters";
import { ReportKpi } from "@/components/app/reports/ReportKpi";
import { rangeFromPreset, inRange, type DateRange, type PresetKey } from "@/lib/date-presets";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useProjects } from "@/hooks/use-projects";
import { useClientsData } from "@/hooks/use-clients-data";
import { useProjectPayments } from "@/hooks/use-project-payments";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/c/$slug/_app/reports/accounts")({
  component: AccountsReport,
  head: () => ({ meta: [{ title: "Accounts Report — Smart Work Flow" }] }),
});

const STATUS_OPTS = [
  { value: "all", label: "All statuses" },
  { value: "not_started", label: "Not started" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function AccountsReport() {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { clients } = useClientsData();
  const { payments } = useProjectPayments();

  const [preset, setPreset] = useState<PresetKey>("all");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("all"));
  const [status, setStatus] = useState("all");
  const [client, setClient] = useState("all");

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  // Payments in the selected date range
  const paymentsInRange = useMemo(
    () => payments.filter((p) => inRange(p.paid_on, range)),
    [payments, range],
  );

  // Aggregate per project (uses ALL payments for received/pending totals; range filters chart + receivedInRange column)
  const rows = useMemo(() => {
    const receivedAll = new Map<string, { total: number; last: string | null }>();
    for (const p of payments) {
      const cur = receivedAll.get(p.project_id) ?? { total: 0, last: null };
      cur.total += p.amount;
      if (!cur.last || p.paid_on > cur.last) cur.last = p.paid_on;
      receivedAll.set(p.project_id, cur);
    }
    const receivedInRangeMap = new Map<string, number>();
    for (const p of paymentsInRange) {
      receivedInRangeMap.set(p.project_id, (receivedInRangeMap.get(p.project_id) ?? 0) + p.amount);
    }
    return projects
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => (client === "all" ? true : p.client_id === client))
      .map((project) => {
        const c = clientById.get(project.client_id);
        const final = Number(project.final_price ?? 0);
        const { total: received, last } = receivedAll.get(project.id) ?? { total: 0, last: null };
        const receivedInRange = receivedInRangeMap.get(project.id) ?? 0;
        const pending = Math.max(final - received, 0);
        const pct = final > 0 ? Math.min(100, Math.round((received / final) * 100)) : 0;
        return { project, client: c, final, received, receivedInRange, pending, pct, last };
      })
      .sort((a, b) => b.pending - a.pending);
  }, [projects, payments, paymentsInRange, clientById, status, client]);

  const kpi = useMemo(() => {
    const totalReceivedInRange = paymentsInRange
      .filter((p) => {
        const proj = projects.find((x) => x.id === p.project_id);
        if (!proj) return false;
        if (status !== "all" && proj.status !== status) return false;
        if (client !== "all" && proj.client_id !== client) return false;
        return true;
      })
      .reduce((s, p) => s + p.amount, 0);
    const totalFinal = rows.reduce((s, r) => s + r.final, 0);
    const totalReceived = rows.reduce((s, r) => s + r.received, 0);
    const totalOutstanding = rows.reduce((s, r) => s + r.pending, 0);
    const rate = totalFinal > 0 ? Math.round((totalReceived / totalFinal) * 100) : 0;
    const pendingProjects = rows.filter((r) => r.pending > 0).length;
    return { totalReceivedInRange, totalOutstanding, rate, pendingProjects };
  }, [rows, paymentsInRange, projects, status, client]);

  // Daily chart of collections in range
  const chart = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of paymentsInRange) {
      const proj = projects.find((x) => x.id === p.project_id);
      if (!proj) continue;
      if (status !== "all" && proj.status !== status) continue;
      if (client !== "all" && proj.client_id !== client) continue;
      const d = p.paid_on.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + p.amount);
    }
    const arr = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const max = arr.reduce((m, [, v]) => Math.max(m, v), 0);
    return { arr, max };
  }, [paymentsInRange, projects, status, client]);

  function reset() {
    setPreset("all");
    setRange(rangeFromPreset("all"));
    setStatus("all");
    setClient("all");
  }

  function onExport() {
    const csv = toCsv(rows, [
      { key: "client", label: "Client", value: (r) => r.client?.name ?? "—" },
      { key: "project", label: "Project", value: (r) => r.project.name },
      { key: "status", label: "Status", value: (r) => r.project.status },
      { key: "final", label: "Final Price", value: (r) => r.final },
      { key: "received", label: "Received", value: (r) => r.received },
      { key: "received_in_range", label: "Received (range)", value: (r) => r.receivedInRange },
      { key: "pending", label: "Pending", value: (r) => r.pending },
      { key: "pct", label: "Collected %", value: (r) => r.pct },
      { key: "last", label: "Last Payment", value: (r) => r.last ?? "" },
    ]);
    downloadCsv(`accounts-report-${Date.now()}.csv`, csv);
  }

  return (
    <ReportShell title="Accounts Report" subtitle="Collections, outstanding balances and collection rate by project">
      <ReportFilters
        preset={preset} onPreset={setPreset}
        range={range} onRange={setRange}
        onReset={reset} onExport={onExport}
        extras={[
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_OPTS },
          { id: "client", label: "Client", value: client, onChange: setClient,
            options: [{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))] },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Received (range)" value={formatINR(kpi.totalReceivedInRange)} icon={Wallet} />
        <ReportKpi label="Outstanding" value={formatINR(kpi.totalOutstanding)} hint={`${kpi.pendingProjects} pending`} icon={AlertTriangle} />
        <ReportKpi label="Collection rate" value={`${kpi.rate}%`} icon={Percent} />
        <ReportKpi label="Projects" value={rows.length} icon={FolderKanban} />
      </div>

      <div className="glass rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm">Collections over time</h3>
          <span className="text-xs text-muted-foreground">
            {chart.arr.length ? `${chart.arr.length} day${chart.arr.length === 1 ? "" : "s"}` : "No payments in range"}
          </span>
        </div>
        {chart.arr.length > 0 ? (
          <div className="flex items-end gap-1 h-40">
            {chart.arr.map(([day, amt]) => {
              const h = chart.max > 0 ? Math.max(4, (amt / chart.max) * 100) : 0;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                  <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition truncate">{formatINR(amt)}</div>
                  <div className="w-full bg-gradient-primary rounded-t" style={{ height: `${h}%` }} title={`${day}: ${formatINR(amt)}`} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-40 grid place-items-center text-sm text-muted-foreground">No payments in this range.</div>
        )}
      </div>

      <div className="glass rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Project</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Final</th>
              <th className="text-right px-4 py-3">Received</th>
              <th className="text-right px-4 py-3">Pending</th>
              <th className="text-left px-4 py-3">Last Payment</th>
              <th className="text-right px-4 py-3">Collected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.project.id}
                className="border-t border-glass-border hover:bg-white/5 cursor-pointer"
                onClick={() => navigate({ to: "/c/$slug/projects/$projectId", params: { projectId: r.project.id } })}
              >
                <td className="px-4 py-3">{r.client?.name ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{r.project.name}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{r.project.status.replace("_", " ")}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{formatINR(r.final)}</td>
                <td className="px-4 py-3 text-right">{formatINR(r.received)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${r.pending > 0 ? "text-neon-pink" : "text-muted-foreground"}`}>
                  {formatINR(r.pending)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.last ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="w-10 text-right">{r.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No projects match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}