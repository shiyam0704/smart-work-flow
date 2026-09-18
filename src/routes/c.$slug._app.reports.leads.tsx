import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, TrendingUp, IndianRupee, Trophy } from "lucide-react";
import { ReportShell } from "@/components/app/reports/ReportShell";
import { ReportFilters } from "@/components/app/reports/ReportFilters";
import { ReportKpi } from "@/components/app/reports/ReportKpi";
import { rangeFromPreset, inRange, type DateRange, type PresetKey } from "@/lib/date-presets";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useLeads, STAGE_LABEL, type LeadStage } from "@/hooks/use-leads";
import { useEmployees } from "@/hooks/use-employees";

export const Route = createFileRoute("/c/$slug/_app/reports/leads")({
  component: LeadsReport,
  head: () => ({ meta: [{ title: "Leads Report — Smart Work Flow" }] }),
});

const STAGE_OPTS: { value: string; label: string }[] = [
  { value: "all", label: "All stages" },
  { value: "new_lead", label: STAGE_LABEL.new_lead },
  { value: "follow_up", label: STAGE_LABEL.follow_up },
  { value: "quoted", label: STAGE_LABEL.quoted },
  { value: "closed", label: STAGE_LABEL.closed },
];

function LeadsReport() {
  const { leads } = useLeads();
  const { employees } = useEmployees();

  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("30d"));
  const [stage, setStage] = useState("all");
  const [capturedBy, setCapturedBy] = useState("all");
  const [followedBy, setFollowedBy] = useState("all");
  const [source, setSource] = useState("all");

  const sources = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => l.lead_source && s.add(l.lead_source));
    return Array.from(s).sort();
  }, [leads]);

  const empName = (id: string | null) => {
    if (!id) return "—";
    return employees.find((x) => x.id === id)?.name ?? "—";
  };

  const leadEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (!inRange(l.created_at, range)) return false;
      if (stage !== "all" && l.current_stage !== stage) return false;
      if (capturedBy !== "all" && l.captured_by_employee_id !== capturedBy) return false;
      if (followedBy !== "all" && l.followed_by_employee_id !== followedBy) return false;
      if (source !== "all" && l.lead_source !== source) return false;
      return true;
    });
  }, [leads, range, stage, capturedBy, followedBy, source]);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const won = filtered.filter((l) => l.outcome === "success");
    const lost = filtered.filter((l) => l.outcome === "unsuccess");
    const decided = won.length + lost.length;
    const pipeline = filtered
      .filter((l) => l.outcome !== "unsuccess")
      .reduce((s, l) => s + (Number(l.final_price) || 0), 0);
    const wonValue = won.reduce((s, l) => s + (Number(l.final_price) || 0), 0);
    const conv = decided ? Math.round((won.length / decided) * 100) : 0;
    return { total, won: won.length, lost: lost.length, conv, pipeline, wonValue };
  }, [filtered]);

  const stageCounts = useMemo(() => {
    const map: Record<LeadStage, number> = { new_lead: 0, follow_up: 0, quoted: 0, closed: 0 };
    filtered.forEach((l) => (map[l.current_stage] += 1));
    const max = Math.max(1, ...Object.values(map));
    return { map, max };
  }, [filtered]);

  function reset() {
    setPreset("30d");
    setRange(rangeFromPreset("30d"));
    setStage("all");
    setCapturedBy("all");
    setFollowedBy("all");
    setSource("all");
  }

  function onExport() {
    const csv = toCsv(filtered, [
      { key: "company", label: "Company", value: (l) => l.company_name },
      { key: "contact", label: "Contact", value: (l) => l.contact_person },
      { key: "phone", label: "Phone", value: (l) => l.contact_number },
      { key: "stage", label: "Stage", value: (l) => STAGE_LABEL[l.current_stage] },
      { key: "outcome", label: "Outcome", value: (l) => l.outcome ?? "" },
      { key: "source", label: "Source", value: (l) => l.lead_source },
      { key: "captured_by", label: "Captured by", value: (l) => empName(l.captured_by_employee_id) },
      { key: "followed_by", label: "Followed by", value: (l) => empName(l.followed_by_employee_id) },
      { key: "price", label: "Final Price", value: (l) => l.final_price ?? "" },
      { key: "created", label: "Created", value: (l) => l.created_at.slice(0, 10) },
    ]);
    downloadCsv(`leads-report-${Date.now()}.csv`, csv);
  }

  const empOpts = [
    { value: "all", label: "All" },
    ...leadEmployees.map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <ReportShell title="Leads Report" subtitle="Pipeline performance, conversion and value">
      <ReportFilters
        preset={preset} onPreset={setPreset}
        range={range} onRange={setRange}
        onReset={reset} onExport={onExport}
        extras={[
          { id: "stage", label: "Stage", value: stage, onChange: setStage, options: STAGE_OPTS },
          { id: "captured", label: "Captured by", value: capturedBy, onChange: setCapturedBy, options: empOpts },
          { id: "followed", label: "Followed by", value: followedBy, onChange: setFollowedBy, options: empOpts },
          { id: "source", label: "Source", value: source, onChange: setSource,
            options: [{ value: "all", label: "All sources" }, ...sources.map((s) => ({ value: s, label: s }))] },
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total leads" value={kpi.total} icon={Sparkles} />
        <ReportKpi label="Conversion rate" value={`${kpi.conv}%`} hint={`${kpi.won} won · ${kpi.lost} lost`} icon={TrendingUp} />
        <ReportKpi label="Pipeline value" value={`₹${kpi.pipeline.toLocaleString()}`} icon={IndianRupee} />
        <ReportKpi label="Won value" value={`₹${kpi.wonValue.toLocaleString()}`} icon={Trophy} />
      </div>

      <div className="glass rounded-2xl p-5 shadow-card">
        <h3 className="font-display font-semibold mb-3">Stage distribution</h3>
        <div className="space-y-2">
          {(Object.keys(stageCounts.map) as LeadStage[]).map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div className="w-24 text-sm text-muted-foreground">{STAGE_LABEL[s]}</div>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-primary transition-[width] duration-500"
                  style={{ width: `${(stageCounts.map[s] / stageCounts.max) * 100}%` }}
                />
              </div>
              <div className="w-10 text-right text-sm font-semibold">{stageCounts.map[s]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">Stage</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Captured by</th>
              <th className="text-left px-4 py-3">Followed by</th>
              <th className="text-right px-4 py-3">Final price</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-medium">{l.company_name}</td>
                <td className="px-4 py-3">{STAGE_LABEL[l.current_stage]}{l.outcome ? ` · ${l.outcome === "success" ? "Won" : "Lost"}` : ""}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.lead_source || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{empName(l.captured_by_employee_id)}</td>
                <td className="px-4 py-3 text-muted-foreground">{empName(l.followed_by_employee_id)}</td>
                <td className="px-4 py-3 text-right">{l.final_price != null ? `₹${Number(l.final_price).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.created_at.slice(0, 10)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No leads match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
