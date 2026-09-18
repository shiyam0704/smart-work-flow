import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, ListChecks, CheckCircle2, AlertTriangle } from "lucide-react";
import { ReportShell } from "@/components/app/reports/ReportShell";
import { ReportFilters } from "@/components/app/reports/ReportFilters";
import { ReportKpi } from "@/components/app/reports/ReportKpi";
import { rangeFromPreset, inRange, type DateRange, type PresetKey } from "@/lib/date-presets";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useEmployees } from "@/hooks/use-employees";
import { useDepartments } from "@/hooks/use-departments";
import { useTasks } from "@/hooks/use-tasks";
import { useWorkflowStates } from "@/hooks/use-workflow-states";

export const Route = createFileRoute("/c/$slug/_app/reports/employees")({
  component: EmployeesReport,
  head: () => ({ meta: [{ title: "Employees Report — Smart Work Flow" }] }),
});

const STATUS_OPTS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function EmployeesReport() {
  const { employees } = useEmployees();
  const { departments } = useDepartments();
  const { tasks } = useTasks();
  const { states } = useWorkflowStates();

  const doneIds = useMemo(
    () => new Set(states.filter((s) => /done|complete/i.test(s.name)).map((s) => s.id)),
    [states],
  );

  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("30d"));
  const [status, setStatus] = useState("all");
  const [dept, setDept] = useState("all");

  const visible = useMemo(() => {
    return employees
      .filter((e) => (status === "all" ? true : e.status === status))
      .filter((e) => (dept === "all" ? true : e.department_id === dept));
  }, [employees, status, dept]);

  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    return visible.map((e) => {
      const eTasks = tasks.filter(
        (t) => t.assignee_ids.includes(e.id) && inRange((t as any).created_at ?? null, range),
      );
      const completed = eTasks.filter((t) => t.status_id && doneIds.has(t.status_id)).length;
      const open = eTasks.length - completed;
      const overdue = eTasks.filter(
        (t) => t.due_date && t.due_date < today && !(t.status_id && doneIds.has(t.status_id)),
      ).length;
      return { emp: e, total: eTasks.length, completed, open, overdue };
    });
  }, [visible, tasks, range, doneIds, today]);

  const kpi = useMemo(() => {
    const total = visible.length;
    const totalTasks = rows.reduce((s, r) => s + r.total, 0);
    const avg = visible.length ? Math.round(totalTasks / visible.length) : 0;
    const top = [...rows].sort((a, b) => b.completed - a.completed)[0];
    return { total, avg, top };
  }, [visible, rows]);

  const deptName = (id: string | null) => (id ? departments.find((d) => d.id === id)?.name ?? "—" : "—");

  function reset() {
    setPreset("30d");
    setRange(rangeFromPreset("30d"));
    setStatus("all"); setDept("all");
  }

  function onExport() {
    const csv = toCsv(rows, [
      { key: "name", label: "Employee", value: (r) => r.emp.name },
      { key: "email", label: "Email", value: (r) => r.emp.email },
      { key: "department", label: "Department", value: (r) => deptName(r.emp.department_id) },
      { key: "role", label: "Role", value: (r) => r.emp.role },
      { key: "status", label: "Status", value: (r) => r.emp.status },
      { key: "total", label: "Total tasks", value: (r) => r.total },
      { key: "open", label: "Open", value: (r) => r.open },
      { key: "completed", label: "Completed", value: (r) => r.completed },
      { key: "overdue", label: "Overdue", value: (r) => r.overdue },
    ]);
    downloadCsv(`employees-report-${Date.now()}.csv`, csv);
  }

  return (
    <ReportShell title="Employees Report" subtitle="Workload and completion per employee">
      <ReportFilters
        preset={preset} onPreset={setPreset}
        range={range} onRange={setRange}
        onReset={reset} onExport={onExport}
        extras={[
          { id: "status", label: "Employee status", value: status, onChange: setStatus, options: STATUS_OPTS },
          { id: "dept", label: "Department", value: dept, onChange: setDept,
            options: [{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))] },
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total employees" value={kpi.total} icon={Users} />
        <ReportKpi label="Avg. tasks / person" value={kpi.avg} icon={ListChecks} />
        <ReportKpi label="Top performer" value={kpi.top?.emp.name ?? "—"} hint={kpi.top ? `${kpi.top.completed} completed` : undefined} icon={CheckCircle2} />
        <ReportKpi label="Total overdue" value={rows.reduce((s, r) => s + r.overdue, 0)} icon={AlertTriangle} />
      </div>

      <div className="glass rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-right px-4 py-3">Open</th>
              <th className="text-right px-4 py-3">Completed</th>
              <th className="text-right px-4 py-3">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.emp.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-medium">{r.emp.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{deptName(r.emp.department_id)}</td>
                <td className="px-4 py-3 capitalize">{r.emp.status}</td>
                <td className="px-4 py-3 text-right">{r.total}</td>
                <td className="px-4 py-3 text-right">{r.open}</td>
                <td className="px-4 py-3 text-right">{r.completed}</td>
                <td className={`px-4 py-3 text-right ${r.overdue ? "text-neon-pink font-semibold" : ""}`}>{r.overdue}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No employees match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
