import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { ReportShell } from "@/components/app/reports/ReportShell";
import { ReportFilters } from "@/components/app/reports/ReportFilters";
import { ReportKpi } from "@/components/app/reports/ReportKpi";
import { rangeFromPreset, inRange, type DateRange, type PresetKey } from "@/lib/date-presets";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useProjects } from "@/hooks/use-projects";
import { useClientsData } from "@/hooks/use-clients-data";
import { useDepartments } from "@/hooks/use-departments";
import { useTasks } from "@/hooks/use-tasks";
import { useWorkflowStates } from "@/hooks/use-workflow-states";

export const Route = createFileRoute("/c/$slug/_app/reports/projects")({
  component: ProjectsReport,
  head: () => ({ meta: [{ title: "Projects Report — Smart Work Flow" }] }),
});

const STATUS_OPTS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function ProjectsReport() {
  const { projects } = useProjects();
  const { clients } = useClientsData();
  const { departments } = useDepartments();
  const { tasks } = useTasks();
  const { states } = useWorkflowStates();

  const doneStateIds = useMemo(
    () => new Set(states.filter((s) => /done|complete/i.test(s.name)).map((s) => s.id)),
    [states],
  );

  const [preset, setPreset] = useState<PresetKey>("all");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("all"));
  const [status, setStatus] = useState("all");
  const [client, setClient] = useState("all");
  const [dept, setDept] = useState("all");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (!inRange(p.deadline_date, range)) return false;
      if (status !== "all" && p.status !== status) return false;
      if (client !== "all" && p.client_id !== client) return false;
      if (dept !== "all" && !p.department_ids.includes(dept)) return false;
      return true;
    });
  }, [projects, range, status, client, dept]);

  const progressOf = (projectId: string) => {
    const pTasks = tasks.filter((t) => Boolean(projectId) && Boolean(t.project_id) && t.project_id === projectId);
    if (!pTasks.length) return 0;
    const done = pTasks.filter((t) => t.status_id && doneStateIds.has(t.status_id)).length;
    return Math.round((done / pTasks.length) * 100);
  };

  const kpi = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((p) => p.status === "active").length;
    const completed = filtered.filter((p) => p.status === "completed").length;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = filtered.filter(
      (p) => p.status !== "completed" && p.deadline_date && p.deadline_date < today,
    ).length;
    const avgProgress = total
      ? Math.round(filtered.reduce((s, p) => s + progressOf(p.id), 0) / total)
      : 0;
    return { total, active, completed, overdue, avgProgress };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, tasks, doneStateIds]);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const deptNames = (ids: string[]) =>
    ids.map((i) => departments.find((d) => d.id === i)?.name).filter(Boolean).join(", ") || "—";

  function reset() {
    setPreset("all");
    setRange(rangeFromPreset("all"));
    setStatus("all"); setClient("all"); setDept("all");
  }

  function onExport() {
    const csv = toCsv(filtered, [
      { key: "name", label: "Project", value: (p) => p.name },
      { key: "client", label: "Client", value: (p) => clientName(p.client_id) },
      { key: "departments", label: "Departments", value: (p) => deptNames(p.department_ids) },
      { key: "status", label: "Status", value: (p) => p.status },
      { key: "start_date", label: "Start", value: (p) => p.start_date ?? "" },
      { key: "deadline", label: "Deadline", value: (p) => p.deadline_date ?? "" },
      { key: "progress", label: "Progress %", value: (p) => progressOf(p.id) },
    ]);
    downloadCsv(`projects-report-${Date.now()}.csv`, csv);
  }

  return (
    <ReportShell title="Projects Report" subtitle="Status, deadlines and progress across all projects">
      <ReportFilters
        preset={preset} onPreset={setPreset}
        range={range} onRange={setRange}
        onReset={reset} onExport={onExport}
        extras={[
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_OPTS },
          { id: "client", label: "Client", value: client, onChange: setClient,
            options: [{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))] },
          { id: "dept", label: "Department", value: dept, onChange: setDept,
            options: [{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))] },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReportKpi label="Active" value={kpi.active} hint={`${kpi.completed} completed`} icon={Activity} />
        <ReportKpi label="Overdue" value={kpi.overdue} icon={AlertTriangle} />
        <ReportKpi label="Avg. progress" value={`${kpi.avgProgress}%`} icon={CheckCircle2} />
      </div>

      <div className="glass rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Project</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Start</th>
              <th className="text-left px-4 py-3">Deadline</th>
              <th className="text-right px-4 py-3">Progress</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const pr = progressOf(p.id);
              const today = new Date().toISOString().slice(0, 10);
              const overdue = p.status !== "completed" && p.deadline_date && p.deadline_date < today;
              return (
                <tr key={p.id} className="border-t border-glass-border">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{clientName(p.client_id)}</td>
                  <td className="px-4 py-3 capitalize">{p.status.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.start_date ?? "—"}</td>
                  <td className={`px-4 py-3 ${overdue ? "text-neon-pink font-semibold" : "text-muted-foreground"}`}>{p.deadline_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-gradient-primary" style={{ width: `${pr}%` }} />
                      </div>
                      <span className="w-10 text-right">{pr}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No projects match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
