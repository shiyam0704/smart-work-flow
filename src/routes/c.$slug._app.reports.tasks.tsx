import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ListChecks, CheckCircle2, AlertTriangle, CalendarClock } from "lucide-react";
import { ReportShell } from "@/components/app/reports/ReportShell";
import { ReportFilters } from "@/components/app/reports/ReportFilters";
import { ReportKpi } from "@/components/app/reports/ReportKpi";
import { rangeFromPreset, inRange, type DateRange, type PresetKey } from "@/lib/date-presets";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useTasks } from "@/hooks/use-tasks";
import { useDepartments } from "@/hooks/use-departments";
import { useEmployees } from "@/hooks/use-employees";
import { useClientsData } from "@/hooks/use-clients-data";
import { useProjects } from "@/hooks/use-projects";
import { useWorkflowStates } from "@/hooks/use-workflow-states";

export const Route = createFileRoute("/c/$slug/_app/reports/tasks")({
  component: TasksReport,
  head: () => ({ meta: [{ title: "Tasks Report — Smart Work Flow" }] }),
});

const PRIORITY_OPTS = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function TasksReport() {
  const { tasks } = useTasks();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { clients } = useClientsData();
  const { projects } = useProjects();
  const { states } = useWorkflowStates();

  const doneIds = useMemo(
    () => new Set(states.filter((s) => /done|complete/i.test(s.name)).map((s) => s.id)),
    [states],
  );

  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("30d"));
  const [statusId, setStatusId] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dept, setDept] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [project, setProject] = useState("all");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (!inRange((t as any).created_at ?? null, range)) return false;
      if (statusId !== "all" && t.status_id !== statusId) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (dept !== "all" && t.department_id !== dept) return false;
      if (project !== "all" && t.project_id !== project) return false;
      if (assignee !== "all" && !t.assignee_ids.includes(assignee)) return false;
      return true;
    });
  }, [tasks, range, statusId, priority, dept, assignee, project]);

  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter((t) => t.status_id && doneIds.has(t.status_id)).length;
    const overdue = filtered.filter((t) => t.due_date && t.due_date < today && !(t.status_id && doneIds.has(t.status_id))).length;
    const dueWeek = filtered.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekAhead).length;
    return { total, completed, overdue, dueWeek };
  }, [filtered, doneIds, today, weekAhead]);

  const nameOf = {
    dept: (id: string | null) => departments.find((d) => d.id === id)?.name ?? "—",
    state: (id: string | null) => states.find((s) => s.id === id)?.name ?? "—",
    client: (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—",
    project: (id: string | null) => projects.find((p) => p.id === id)?.name ?? "—",
    employees: (ids: string[]) => ids.map((i) => employees.find((e) => e.id === i)?.name).filter(Boolean).join(", ") || "—",
  };

  function reset() {
    setPreset("30d");
    setRange(rangeFromPreset("30d"));
    setStatusId("all"); setPriority("all"); setDept("all");
    setAssignee("all"); setProject("all");
  }

  function onExport() {
    const csv = toCsv(filtered, [
      { key: "title", label: "Title", value: (t) => t.title },
      { key: "status", label: "Status", value: (t) => nameOf.state(t.status_id) },
      { key: "priority", label: "Priority", value: (t) => t.priority },
      { key: "department", label: "Department", value: (t) => nameOf.dept(t.department_id) },
      { key: "client", label: "Client", value: (t) => nameOf.client(t.client_id) },
      { key: "project", label: "Project", value: (t) => nameOf.project(t.project_id) },
      { key: "assignees", label: "Assignees", value: (t) => nameOf.employees(t.assignee_ids) },
      { key: "due_date", label: "Due date", value: (t) => t.due_date ?? "" },
    ]);
    downloadCsv(`tasks-report-${Date.now()}.csv`, csv);
  }

  return (
    <ReportShell title="Tasks Report" subtitle="Detailed task list with full filtering">
      <ReportFilters
        preset={preset} onPreset={setPreset}
        range={range} onRange={setRange}
        onReset={reset} onExport={onExport}
        extras={[
          { id: "status", label: "Status", value: statusId, onChange: setStatusId,
            options: [{ value: "all", label: "All statuses" }, ...states.map((s) => ({ value: s.id, label: s.name }))] },
          { id: "priority", label: "Priority", value: priority, onChange: setPriority, options: PRIORITY_OPTS },
          { id: "dept", label: "Department", value: dept, onChange: setDept,
            options: [{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))] },
          { id: "assignee", label: "Assignee", value: assignee, onChange: setAssignee,
            options: [{ value: "all", label: "All assignees" }, ...employees.map((e) => ({ value: e.id, label: e.name }))] },
          { id: "project", label: "Project", value: project, onChange: setProject,
            options: [{ value: "all", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.name }))] },
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total" value={kpi.total} icon={ListChecks} />
        <ReportKpi label="Completed" value={kpi.completed} icon={CheckCircle2} />
        <ReportKpi label="Overdue" value={kpi.overdue} icon={AlertTriangle} />
        <ReportKpi label="Due this week" value={kpi.dueWeek} icon={CalendarClock} />
      </div>

      <div className="glass rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Assignees</th>
              <th className="text-left px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const overdue = t.due_date && t.due_date < today && !(t.status_id && doneIds.has(t.status_id));
              return (
                <tr key={t.id} className="border-t border-glass-border">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{nameOf.state(t.status_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{nameOf.dept(t.department_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{nameOf.client(t.client_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{nameOf.employees(t.assignee_ids)}</td>
                  <td className={`px-4 py-3 ${overdue ? "text-neon-pink font-semibold" : "text-muted-foreground"}`}>{t.due_date ?? "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No tasks match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
