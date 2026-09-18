import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { History, Download, ChevronDown, Plus, Pencil, Trash2, Search } from "lucide-react";
import { RoleGuard } from "@/components/app/RoleGuard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useAuditLog, AUDIT_ENTITIES, AUDIT_ACTIONS, entityLabel, visibleDiff,
  type AuditFilters, type AuditRow,
} from "@/hooks/use-audit-log";
import { PRESETS, rangeFromPreset, type PresetKey, type DateRange } from "@/lib/date-presets";
import { useCompanyFormats } from "@/hooks/use-company";
import { formatDateTime } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/c/$slug/_app/settings/audit")({
  component: () => (
    <RoleGuard allow={[]} permission="nav.audit">
      <AuditPage />
    </RoleGuard>
  ),
  head: () => ({
    meta: [
      { title: "Audit Trail — Smart Work Flow" },
      { name: "description", content: "Admin-only record of who changed what and when across the workspace." },
    ],
  }),
});

const ACTION_META: Record<string, { icon: typeof Plus; cls: string; label: string }> = {
  created: { icon: Plus, cls: "bg-emerald-500/15 text-emerald-500", label: "Created" },
  updated: { icon: Pencil, cls: "bg-amber-500/15 text-amber-500", label: "Updated" },
  deleted: { icon: Trash2, cls: "bg-destructive/15 text-destructive", label: "Deleted" },
};

function fmtVal(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function AuditPage() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("30d"));
  const [actorId, setActorId] = useState("");
  const [table, setTable] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");

  const filters: AuditFilters = { range, actorId, table, action, search };
  const { rows, loading, hasMore, loadMore, actors } = useAuditLog(filters);
  const { timezone, dateFormat, timeFormat } = useCompanyFormats();

  function applyPreset(k: PresetKey) {
    setPreset(k);
    if (k !== "custom") setRange(rangeFromPreset(k));
  }

  const when = (r: AuditRow) =>
    formatDateTime(r.created_at, dateFormat as any, timeFormat, timezone);

  function exportCsv() {
    exportRowsAsCsv("audit-trail", rows, [
      { key: "when", label: "When", value: (r) => when(r) },
      { key: "who", label: "Who", value: (r) => r.actor_email ?? "System" },
      { key: "action", label: "Action", value: (r) => ACTION_META[r.action]?.label ?? r.action },
      { key: "type", label: "Record type", value: (r) => entityLabel(r.table_name) },
      { key: "record", label: "Record", value: (r) => r.record_label },
      { key: "fields", label: "Changed fields", value: (r) => (r.changed_fields ?? []).join(", ") },
    ]);
  }

  const hasFilters = useMemo(
    () => !!(actorId || table || action || search.trim() || preset !== "30d"),
    [actorId, table, action, search, preset],
  );

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 shadow-card flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
          <History className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">
            Who did what and when. Entries are recorded automatically and cannot be edited or removed.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="w-4 h-4 mr-1.5" /> Export
        </Button>
      </div>

      <div className="glass rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                preset === p.key
                  ? "bg-gradient-primary text-white border-transparent shadow-glow"
                  : "border-glass-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date" className="w-auto"
              value={range.from ?? ""}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || null }))}
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date" className="w-auto"
              value={range.to ?? ""}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || null }))}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search record or person"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={actorId || "all"} onValueChange={(v) => setActorId(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Anyone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={table || "all"} onValueChange={(v) => setTable(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All records" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All records</SelectItem>
              {AUDIT_ENTITIES.map((e) => (
                <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action || "all"} onValueChange={(v) => setAction(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{ACTION_META[a]!.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass rounded-2xl shadow-card divide-y divide-glass-border overflow-hidden">
        {loading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading activity…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No activity {hasFilters ? "matches these filters" : "recorded yet"}.
          </div>
        )}
        {rows.map((r) => (
          <AuditEntry key={r.id} row={r} when={when(r)} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function AuditEntry({ row, when }: { row: AuditRow; when: string }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[row.action] ?? ACTION_META["updated"]!;
  const Icon = meta.icon;
  const diff = visibleDiff(row);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition"
      >
        <span className={cn("w-8 h-8 rounded-lg grid place-items-center shrink-0", meta.cls)}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm">
            <span className="font-semibold">{row.actor_email ?? "System"}</span>
            <span className="text-muted-foreground"> {meta.label.toLowerCase()} </span>
            <span className="text-muted-foreground">{entityLabel(row.table_name)}</span>
            {row.record_label && <span className="font-medium"> — {row.record_label}</span>}
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            {when}
            {row.action === "updated" && row.changed_fields.length > 0 && (
              <> · {row.changed_fields.length} field{row.changed_fields.length > 1 ? "s" : ""} changed</>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground shrink-0 transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pl-15">
          {diff.length === 0 ? (
            <p className="text-xs text-muted-foreground">No field details recorded.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-glass-border">
              <table className="w-full text-xs min-w-[420px]">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Field</th>
                    <th className="text-left px-3 py-2 font-semibold">Before</th>
                    <th className="text-left px-3 py-2 font-semibold">After</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((d) => (
                    <tr key={d.field} className="border-t border-glass-border align-top">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{d.field}</td>
                      <td className="px-3 py-2 text-muted-foreground break-all">{fmtVal(d.before)}</td>
                      <td className="px-3 py-2 break-all">{fmtVal(d.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}