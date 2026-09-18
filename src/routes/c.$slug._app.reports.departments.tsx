import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Briefcase, CheckCircle2, AlertTriangle, ListChecks } from "lucide-react";
import { ReportShell } from "@/components/app/reports/ReportShell";
import { ReportFilters } from "@/components/app/reports/ReportFilters";
import { ReportKpi } from "@/components/app/reports/ReportKpi";
import { rangeFromPreset, inRange, type DateRange, type PresetKey } from "@/lib/date-presets";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useDepartments } from "@/hooks/use-departments";
import { useTasks } from "@/hooks/use-tasks";
import { useWorkflowStates } from "@/hooks/use-workflow-states";

export const Route = createFileRoute("/c/$slug/_app/reports/departments")({
  component: DepartmentsReport,
  head: () => ({ meta: [{ title: "Departments Report — Smart Work Flow" }] }),
});


function DepartmentsReport() {
  const { departments } = useDepartments();
  const { tasks } = useTasks();
  const { states } = useWorkflowStates();

  const doneIds = useMemo(
    () => new Set(states.filter((s) => /done|complete/i.test(s.name)).map((s) => s.id)),
    [states],
  );

  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("30d"));
  const [dept, setDept] = useState("all");

  const visibleDepartments = useMemo(() => {
    return departments.filter((d) => (dept === "all" ? true : d.id === dept));
  }, [departments, dept]);

  const rows = useMemo(() => {
    return visibleDepartments.map((d) => {
      const dTasks = tasks.filter(
        (t) => t.department_id === d.id && inRange((t as any).created_at ?? null, range),
      );
      const completed = dTasks.filter((t) => t.status_id && doneIds.has(t.status_id)).length;
      const open = dTasks.length - completed;
      const today = new Date().toISOString().slice(0, 10);
      const overdue = dTasks.filter(
        (t) => t.due_date && t.due_date < today && !(t.status_id && doneIds.has(t.status_id)),
      ).length;
      return { dept: d, total: dTasks.length, completed, open, overdue };
    });
  }, [visibleDepartments, tasks, range, doneIds]);

  const kpi = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const completed = rows.reduce((s, r) => s + r.completed, 0);
    const open = rows.reduce((s, r) => s + r.open, 0);
    const overdue = rows.reduce((s, r) => s + r.overdue, 0);
    return { total, completed, open, overdue };
  }, [rows]);

  const max = Math.max(1, ...rows.map((r) => r.total));

  function reset() {
    setPreset("30d");
    setRange(rangeFromPreset("30d"));
    setDept("all");
  }

  function onExport() {
    const csv = toCsv(rows, [
      { key: "department", label: "Department", value: (r) => r.dept.name },
      { key: "total", label: "Total tasks", value: (r) => r.total },
      { key: "open", label: "Open", value: (r) => r.open },
      { key: "completed", label: "Completed", value: (r) => r.completed },
      { key: "overdue", label: "Overdue", value: (r) => r.overdue },
    ]);
    downloadCsv(`departments-report-${Date.now()}.csv`, csv);
  }

  return (
    <ReportShell title="Departments Report" subtitle="Task load and completion across departments">
      <ReportFilters
        preset={preset} onPreset={setPreset}
        range={range} onRange={setRange}
        onReset={reset} onExport={onExport}
        extras={[
          { id: "dept", label: "Department", value: dept, onChange: setDept,
            options: [{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))] },
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total tasks" value={kpi.total} icon={ListChecks} />
        <ReportKpi label="Open" value={kpi.open} icon={Briefcase} />
        <ReportKpi label="Completed" value={kpi.completed} icon={CheckCircle2} />
        <ReportKpi label="Overdue" value={kpi.overdue} icon={AlertTriangle} />
      </div>

      <div className="glass rounded-2xl p-5 shadow-card">
        <h3 className="font-display font-semibold mb-3">Task load by department</h3>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.dept.id} className="flex items-center gap-3">
              <div className="w-40 truncate text-sm">{r.dept.name}</div>
              <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden flex">
                <div
                  className="h-full bg-gradient-primary"
                  style={{ width: `${(r.completed / max) * 100}%` }}
                  title={`Completed ${r.completed}`}
                />
                <div
                  className="h-full bg-neon-cyan/60"
                  style={{ width: `${(r.open / max) * 100}%` }}
                  title={`Open ${r.open}`}
                />
              </div>
              <div className="w-16 text-right text-sm font-semibold">{r.total}</div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No departments match the current filters.</div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-right px-4 py-3">Open</th>
              <th className="text-right px-4 py-3">Completed</th>
              <th className="text-right px-4 py-3">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dept.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-medium">{r.dept.name}</td>
                <td className="px-4 py-3 text-right">{r.total}</td>
                <td className="px-4 py-3 text-right">{r.open}</td>
                <td className="px-4 py-3 text-right">{r.completed}</td>
                <td className={`px-4 py-3 text-right ${r.overdue ? "text-neon-pink font-semibold" : ""}`}>{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
