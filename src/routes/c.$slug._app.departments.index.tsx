import { createFileRoute } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { useMemo } from "react";
import { Topbar } from "@/components/app/Topbar";
import { useDepartments } from "@/hooks/use-departments";
import { useTasks } from "@/hooks/use-tasks";
import { useEmployees } from "@/hooks/use-employees";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { splitTasksByCompletion } from "@/lib/task-status";
import { Briefcase, Sparkles, Users } from "lucide-react";
import { ViewToggle, useViewMode } from "@/components/app/ViewToggle";

export const Route = createFileRoute("/c/$slug/_app/departments/")({
  component: DepartmentsIndex,
  head: () => ({ meta: [{ title: "Departments — Smart Work Flow" }] }),
});

function DepartmentsIndex() {
  const { departments, loading } = useDepartments();
  const { tasks } = useTasks();
  const { employees } = useEmployees();
  const { states } = useWorkflowStates();
  const [view, setView] = useViewMode("departments:view");

  const stats = useMemo(() => {
    const m: Record<string, { total: number; done: number; open: number; pct: number; activeEmployees: number }> = {};
    for (const d of departments) {
      const deptTasks = tasks.filter((t) => t.department_id === d.id);
      const { active, completed } = splitTasksByCompletion(deptTasks, states);
      const total = deptTasks.length;
      const done = completed.length;
      const open = active.length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const activeEmployees = employees.filter(
        (e) => e.department_id === d.id && e.status === "active",
      ).length;
      m[d.id] = { total, done, open, pct, activeEmployees };
    }
    return m;
  }, [departments, tasks, states, employees]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="w-5 h-5 animate-pulse mr-2" /> Loading departments…
      </div>
    );
  }

  const active = departments.filter((d) => d.is_active);

  return (
    <>
      <Topbar title="Departments" subtitle={`${active.length} active departments`} />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-end">
          <ViewToggle value={view} onChange={setView} />
        </div>

        {active.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No departments yet. Create some in Settings → Departments.
          </div>
        )}

        {view === "grid" && active.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {active.map((d) => {
          const s = stats[d.id] ?? { total: 0, done: 0, open: 0, pct: 0, activeEmployees: 0 };
          return (
            <Link
              key={d.id}
              to="/c/$slug/departments/$deptId"
              params={{ deptId: d.id }}
              className="glass rounded-2xl p-5 shadow-card hover:shadow-glow transition group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                  style={{ background: d.color }}
                >
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.code}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {s.done}/{s.total} done · {s.open} open
                  </span>
                  <span className="font-medium text-foreground">{s.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-primary"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <Users className="w-3.5 h-3.5" />
                  {s.activeEmployees} active {s.activeEmployees === 1 ? "employee" : "employees"}
                </div>
              </div>
            </Link>
          );
        })}
          </div>
        )}

        {view === "table" && active.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Department</th>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Employees</th>
                    <th className="text-left px-4 py-3 font-medium">Tasks</th>
                    <th className="text-left px-4 py-3 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((d) => {
                    const s = stats[d.id] ?? { total: 0, done: 0, open: 0, pct: 0, activeEmployees: 0 };
                    return (
                      <tr key={d.id} className="border-t border-glass-border hover:bg-white/5 transition">
                        <td className="px-4 py-3">
                          <Link to="/c/$slug/departments/$deptId" params={{ deptId: d.id }} className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: d.color }}>
                              <Briefcase className="w-4 h-4" />
                            </span>
                            <span className="font-medium truncate">{d.name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{d.code || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.activeEmployees}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.done}/{s.total} · {s.open} open
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-gradient-primary" style={{ width: `${s.pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{s.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
