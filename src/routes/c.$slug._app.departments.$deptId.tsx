import { createFileRoute } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { StatusBadge, PriorityBadge, PriorityDot } from "@/components/app/StatusBadge";
import { InlineTaskEditor } from "@/components/app/InlineTaskEditor";
import { TaskDetailDialog } from "@/components/app/TaskDetailDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDepartments } from "@/hooks/use-departments";
import { useTasks, type TaskRow } from "@/hooks/use-tasks";
import { useClientsData } from "@/hooks/use-clients-data";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { matchesDeadline, splitTasksByCompletion } from "@/lib/task-status";
import { TaskFilters, DEFAULT_TASK_FILTERS, type TaskFiltersValue } from "@/components/app/TaskFilters";
import { ArrowLeft, Briefcase, ChevronDown, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskModal } from "@/components/app/NewTaskModal";

export const Route = createFileRoute("/c/$slug/_app/departments/$deptId")({
  component: DepartmentDetail,
  head: () => ({ meta: [{ title: "Department — Smart Work Flow" }] }),
});

function DepartmentDetail() {
  const { deptId } = Route.useParams();
  const { departments, loading: dLoading } = useDepartments();
  const { tasks, loading: tLoading, updateTask } = useTasks();
  const { open: openNewTask } = useTaskModal();
  const { clients } = useClientsData();
  const { states } = useWorkflowStates();
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);

  const [filters, setFilters] = useState<TaskFiltersValue>(DEFAULT_TASK_FILTERS);

  const dept = departments.find((d) => d.id === deptId);

  const deptTasks = useMemo(
    () => tasks.filter((t) => t.department_id === deptId),
    [tasks, deptId]
  );

  const filteredTasks = useMemo(
    () =>
      deptTasks.filter(
        (t) =>
          (filters.status === "all" || t.status_id === filters.status) &&
          matchesDeadline(t.due_date, filters.deadline),
      ),
    [deptTasks, filters],
  );

  const { active, completed } = useMemo(
    () => splitTasksByCompletion(filteredTasks, states),
    [filteredTasks, states],
  );


  const groupByClient = (list: TaskRow[]) =>
    list.reduce((acc, t) => {
      const key = t.client_id ?? "__unlinked__";
      (acc[key] ??= []).push(t);
      return acc;
    }, {} as Record<string, TaskRow[]>);

  const groupedActive = useMemo(() => groupByClient(active), [active]);
  const groupedDone = useMemo(() => groupByClient(completed), [completed]);

  if (dLoading || tLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="w-5 h-5 animate-pulse mr-2" /> Loading…
      </div>
    );
  }

  if (!dept) {
    return (
      <>
        <Topbar title="Department" />
        <div className="p-6">
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            Department not found.{" "}
            <Link to="/c/$slug/departments" className="underline">Back to departments</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={dept.name} subtitle={`${active.length} active${completed.length ? ` · ${completed.length} completed` : ""}`} />
      <div className="p-6 space-y-5">
        <Link
          to="/c/$slug/departments"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> All departments
        </Link>

        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white"
            style={{ background: dept.color }}
          >
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <div className="font-display text-xl font-semibold">{dept.name}</div>
            <div className="text-xs text-muted-foreground">{dept.code}</div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button
            onClick={() => openNewTask({ deptId })}
            className="bg-gradient-primary text-white shadow-glow"
          >
            <Plus className="w-4 h-4" /> New Linked Task
          </Button>
        </div>

        <TaskFilters value={filters} onChange={setFilters} />


        {deptTasks.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No tasks in this department yet.
          </div>
        )}
        {deptTasks.length > 0 && filteredTasks.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No tasks match the current filters.
          </div>
        )}
        {filteredTasks.length > 0 && active.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            All tasks completed.
          </div>
        )}

        {Object.entries(groupedActive).map(([clientId, list]) => {
          const c = clients.find((x) => x.id === clientId);
          return (
            <div key={clientId} className="glass rounded-2xl shadow-card overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-glass-border">
                <div className="w-10 h-10 rounded-lg bg-gradient-accent flex items-center justify-center text-white font-bold">
                  {c?.logo ?? "?"}
                </div>
                <div>
                  <div className="font-display font-semibold">{c?.name ?? "Unknown client"}</div>
                  <div className="text-xs text-muted-foreground">{list.length} tasks</div>
                </div>
              </div>
              <div className="divide-y divide-glass-border">
                {list.map((t) => (
                  <div key={t.id} className="p-3 sm:p-4 hover:bg-white/5 transition">
                    {/* Desktop layout */}
                    <div className="hidden sm:flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ background: dept.color }} />
                      <button
                        type="button"
                        onClick={() => setOpenTask(t)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="font-medium truncate hover:underline">{t.title}</div>
                      </button>
                      <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0 flex-wrap justify-end">
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge statusId={t.status_id} onChange={(sid) => updateTask(t.id, { status_id: sid })} />
                        <div className="text-xs text-muted-foreground w-24 text-right">{t.due_date ?? "—"}</div>
                        <InlineTaskEditor task={t} />
                      </div>
                    </div>
                    {/* Mobile layout */}
                    <div className="sm:hidden flex items-start gap-3">
                      <div className="w-1 h-10 rounded-full shrink-0 mt-0.5" style={{ background: dept.color }} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start gap-2">
                          <button type="button" onClick={() => setOpenTask(t)} className="flex-1 min-w-0 text-left font-medium truncate hover:underline">
                            {t.title}
                          </button>
                          <div className="shrink-0 -mt-1 -mr-1">
                            <InlineTaskEditor task={t} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap pt-0.5">
                          <span className="text-xs text-muted-foreground">{t.due_date ?? "—"}</span>
                          <PriorityDot priority={t.priority} />
                          <StatusBadge statusId={t.status_id} onChange={(sid) => updateTask(t.id, { status_id: sid })} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {completed.length > 0 && (
          <Collapsible className="space-y-3">
            <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 p-4 glass rounded-2xl hover:bg-white/5 transition">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold">Completed</span>
                <span className="text-xs text-muted-foreground">({completed.length})</span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-5">
              {Object.entries(groupedDone).map(([clientId, list]) => {
                const c = clients.find((x) => x.id === clientId);
                return (
                  <div key={clientId} className="glass rounded-2xl shadow-card overflow-hidden">
                    <div className="flex items-center gap-3 p-4 border-b border-glass-border">
                      <div className="w-10 h-10 rounded-lg bg-gradient-accent flex items-center justify-center text-white font-bold">
                        {c?.logo ?? "?"}
                      </div>
                      <div>
                        <div className="font-display font-semibold">{c?.name ?? "Unknown client"}</div>
                        <div className="text-xs text-muted-foreground">{list.length} tasks</div>
                      </div>
                    </div>
                    <div className="divide-y divide-glass-border">
                      {list.map((t) => (
                        <div key={t.id} className="p-3 sm:p-4 hover:bg-white/5 transition opacity-80">
                          {/* Desktop layout */}
                          <div className="hidden sm:flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                            <div className="w-1 h-10 rounded-full shrink-0" style={{ background: dept.color }} />
                            <button
                              type="button"
                              onClick={() => setOpenTask(t)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <div className="font-medium truncate hover:underline">{t.title}</div>
                            </button>
                            <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0 flex-wrap justify-end">
                              <PriorityBadge priority={t.priority} />
                              <StatusBadge statusId={t.status_id} onChange={(sid) => updateTask(t.id, { status_id: sid })} />
                              <div className="text-xs text-muted-foreground w-24 text-right">{t.due_date ?? "—"}</div>
                              <InlineTaskEditor task={t} />
                            </div>
                          </div>
                          {/* Mobile layout */}
                          <div className="sm:hidden flex items-start gap-3">
                            <div className="w-1 h-10 rounded-full shrink-0 mt-0.5" style={{ background: dept.color }} />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start gap-2">
                                <button type="button" onClick={() => setOpenTask(t)} className="flex-1 min-w-0 text-left font-medium truncate hover:underline">
                                  {t.title}
                                </button>
                                <div className="shrink-0 -mt-1 -mr-1">
                                  <InlineTaskEditor task={t} />
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap pt-0.5">
                                <span className="text-xs text-muted-foreground">{t.due_date ?? "—"}</span>
                                <PriorityDot priority={t.priority} />
                                <StatusBadge statusId={t.status_id} onChange={(sid) => updateTask(t.id, { status_id: sid })} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      <TaskDetailDialog
        task={openTask}
        open={!!openTask}
        onOpenChange={(v) => !v && setOpenTask(null)}
      />
    </>
  );
}
