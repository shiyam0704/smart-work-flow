import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, TrendingUp, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLink as Link } from "@/lib/nav";
import { useMoneyFlow } from "@/hooks/use-money-flow";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { RoleGuard } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/c/$slug/_app/accounts/income")({
  component: () => (
    <RoleGuard permission={["nav.accounts.income", "nav.accounts"]}>
      <IncomePage />
    </RoleGuard>
  ),

  head: () => ({
    meta: [
      { title: "Income — Accounts" },
      { name: "description", content: "Every payment received, from invoices and projects, in one list." },
    ],
  }),
});

const ALL = "all";

function IncomePage() {
  const { income, loading, includeProjectReceipts } = useMoneyFlow();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return income.filter((r) => {
      if (source !== ALL && r.source !== source) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (!q) return true;
      return [r.ref, r.party, r.projectName, r.note].join(" ").toLowerCase().includes(q);
    });
  }, [income, query, source, from, to]);

  const kpi = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const parties = new Set(rows.map((r) => r.party)).size;
    return { total, count: rows.length, parties };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi icon={TrendingUp} label="Total received" value={formatINR(kpi.total)} />
        <Kpi icon={Receipt} label="Receipts" value={String(kpi.count)} />
        <Kpi icon={Users} label="Payers" value={String(kpi.parties)} />
      </div>

      <div className="glass rounded-2xl p-4 shadow-card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Receipt, client, project or note" />
        </div>
        <div className="min-w-[170px]">
          <label className="text-xs text-muted-foreground">Source</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              <SelectItem value="invoice">Invoice receipts</SelectItem>
              {includeProjectReceipts && <SelectItem value="project">Project receipts</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="outline" asChild>
          <Link to="/c/$slug/invoicing/payments">Record a receipt</Link>
        </Button>
        <Button
          variant="outline"
          disabled={rows.length === 0}
          onClick={() =>
            exportRowsAsCsv("income", rows, [
              { key: "date", label: "Date", value: (r) => r.date },
              { key: "source", label: "Source", value: (r) => r.sourceLabel },
              { key: "ref", label: "Reference", value: (r) => r.ref },
              { key: "party", label: "Received From", value: (r) => r.party },
              { key: "project", label: "Project", value: (r) => r.projectName },
              { key: "mode", label: "Mode", value: (r) => r.mode },
              { key: "account", label: "Account", value: (r) => r.accountName },
              { key: "amount", label: "Amount", value: (r) => r.amount },
            ])
          }
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="glass rounded-2xl shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Reference</th>
              <th className="text-left px-4 py-3">Received from</th>
              <th className="text-left px-4 py-3">Project</th>
              <th className="text-left px-4 py-3">Mode</th>
              <th className="text-left px-4 py-3">Account</th>
              <th className="text-right px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border hover:bg-white/5">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.date, "d MMM yyyy")}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.sourceLabel}</td>
                <td className="px-4 py-3">{r.ref}</td>
                <td className="px-4 py-3 font-medium">{r.party}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.projectName || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.mode}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.accountName}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatINR(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                {loading ? "Loading…" : "No money received in this view yet."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display font-semibold text-lg">{value}</div>
      </div>
    </div>
  );
}
