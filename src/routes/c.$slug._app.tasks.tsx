import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useCNavigate as useNavigate } from "@/lib/nav";
import { Topbar } from "@/components/app/Topbar";
import { StatusBadge, PriorityBadge, PriorityDot } from "@/components/app/StatusBadge";
import { InlineTaskEditor } from "@/components/app/InlineTaskEditor";
import { TaskDetailDialog } from "@/components/app/TaskDetailDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTasks, type TaskRow } from "@/hooks/use-tasks";
import { useClientsData } from "@/hooks/use-clients-data";
import { useDepartments } from "@/hooks/use-departments";
import { useEmployees } from "@/hooks/use-employees";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { useAuth } from "@/hooks/use-auth";
import { matchesDeadline, splitTasksByCompletion } from "@/lib/task-status";
import { TaskFilters, DEFAULT_TASK_FILTERS, type TaskFiltersValue } from "@/components/app/TaskFilters";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskModal } from "@/components/app/NewTaskModal";
import { TasksKanbanView } from "@/components/app/TasksKanbanView";
import { TasksListView } from "@/components/app/TasksListView";

const searchSchema = z.object({
  view: fallback(z.string(), "grouped").default("grouped"),
});
type ViewKey = "grouped" | "kanban" | "list";
const VIEW_KEYS: ViewKey[] = ["grouped", "kanban", "list"];

export const Route = createFileRoute("/c/$slug/_app/tasks")({
  component: MyTasks,
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "My Tasks — Smart Work Flow" }] }),
});

function MyTasks() {
  const { view: viewRaw } = Route.useSearch();
  const view: ViewKey = (VIEW_KEYS as string[]).includes(viewRaw) ? (viewRaw as ViewKey) : "grouped";
  const navigate = useNavigate({ from: "/c/$slug/tasks" });
  const setView = (v: ViewKey) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, view: v }) });

  const { user } = useAuth();
  const { tasks, loading, updateTask } = useTasks();
  const { open: openNewTask } = useTaskModal();
  const { clients } = useClientsData();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { states } = useWorkflowStates();
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const activeOpenTask = useMemo(() => {
    if (!openTask) return null;
    return tasks.find((t) => t.id === openTask.id) ?? openTask;
  }, [tasks, openTask]);

  const [filters, setFilters] = useState<TaskFiltersValue>(DEFAULT_TASK_FILTERS);

  const myEmployee = employees.find(
    (e) => (user?.id && e.user_id === user.id) || (user?.email && e.email?.toLowerCase() === user.email?.toLowerCase())
  );

  const myTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        (myEmployee && t.assignee_ids.includes(myEmployee.id)) ||
        (user && t.created_by === user.id && t.assignee_ids.length === 0)
    );
  }, [tasks, myEmployee, user]);

  const filteredTasks = useMemo(() => {
    return myTasks.filter(
      (t) =>
        (filters.status === "all" || t.status_id === filters.status) &&
        matchesDeadline(t.due_date, filters.deadline),
    );
  }, [myTasks, filters]);

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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="w-5 h-5 animate-pulse mr-2" /> Loading tasks…
      </div>
    );
  }

  const renderGroups = (grouped: Record<string, TaskRow[]>) => {
    const entries = Object.entries(grouped).sort(([a], [b]) => {
      if (a === "__unlinked__") return -1;
      if (b === "__unlinked__") return 1;
      return 0;
    });
    return entries.map(([clientId, list]) => {
      const isPersonal = clientId === "__unlinked__";
      const c = isPersonal ? null : clients.find((x) => x.id === clientId);
      if (!isPersonal && !c) return null;
      return (
        <div key={clientId} className="glass rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-glass-border">
            {isPersonal ? (
              <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center text-foreground font-bold">P</div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-accent flex items-center justify-center text-white font-bold">{c!.logo}</div>
            )}
            <div>
              <div className="font-display font-semibold">{isPersonal ? "Personal" : c!.name}</div>
              <div className="text-xs text-muted-foreground">{list.length} tasks</div>
            </div>
          </div>
          <div className="divide-y divide-glass-border">
            {list.map((t) => {
              const d = departments.find((x) => x.id === t.department_id);
              return (
                <div key={t.id} className="p-3 sm:p-4 hover:bg-white/5 transition">
                  {/* Desktop layout */}
                  <div className="hidden sm:flex items-center gap-4">
                    <div className="w-1 h-12 rounded-full shrink-0" style={{ background: d?.color ?? "var(--muted)" }} />
                    <button type="button" onClick={() => setOpenTask(t)} className="flex-1 min-w-0 text-left">
                      <div className="font-medium truncate hover:underline">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{d?.name ?? "—"}</div>
                    </button>
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge statusId={t.status_id} onChange={(sid) => updateTask(t.id, { status_id: sid })} />
                    <div className="text-xs text-muted-foreground w-24 text-right">{t.due_date ?? "—"}</div>
                    <InlineTaskEditor task={t} />
                  </div>
                  {/* Mobile layout */}
                  <div className="sm:hidden flex items-start gap-3">
                    <div className="w-1 h-10 rounded-full shrink-0 mt-0.5" style={{ background: d?.color ?? "var(--muted)" }} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start gap-2">
                        <button type="button" onClick={() => setOpenTask(t)} className="flex-1 min-w-0 text-left font-medium truncate hover:underline">
                          {t.title}
                        </button>
                        <div className="shrink-0 -mt-1 -mr-1">
                          <InlineTaskEditor task={t} />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{d?.name ?? "—"}</div>
                      <div className="flex items-center gap-3 flex-wrap pt-0.5">
                        <span className="text-xs text-muted-foreground">{t.due_date ?? "—"}</span>
                        <PriorityDot priority={t.priority} />
                        <StatusBadge statusId={t.status_id} onChange={(sid) => updateTask(t.id, { status_id: sid })} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <>
      <Topbar title="My Tasks" subtitle={`${active.length} active${completed.length ? ` · ${completed.length} completed` : ""}`} />
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
            <TabsList>
              <TabsTrigger value="grouped">Grouped</TabsTrigger>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            onClick={() => openNewTask({ defaultAssigneeId: myEmployee?.id })}
            className="bg-gradient-primary text-white shadow-glow"
          >
            <Plus className="w-4 h-4" /> New Task
          </Button>
        </div>
        <TaskFilters value={filters} onChange={setFilters} />


        {myTasks.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No tasks assigned to you yet.
          </div>
        )}
        {myTasks.length > 0 && active.length === 0 && completed.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No tasks match the current filters.
          </div>
        )}
        {myTasks.length > 0 && active.length === 0 && completed.length > 0 && view === "grouped" && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            All caught up — no active tasks.
          </div>
        )}
        {view === "grouped" && renderGroups(groupedActive)}
        {view === "kanban" && (
          <TasksKanbanView
            tasks={active}
            canDrag
            onOpen={setOpenTask}
            onStatusChange={(id, sid) => updateTask(id, { status_id: sid })}
          />
        )}
        {view === "list" && (
          <TasksListView
            tasks={active}
            onOpen={setOpenTask}
            onStatusChange={(id, sid) => updateTask(id, { status_id: sid })}
          />
        )}

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
              {view === "grouped" && renderGroups(groupedDone)}
              {view === "list" && (
                <TasksListView
                  tasks={completed}
                  onOpen={setOpenTask}
                  onStatusChange={(id, sid) => updateTask(id, { status_id: sid })}
                />
              )}
              {view === "kanban" && (
                <TasksListView
                  tasks={completed}
                  onOpen={setOpenTask}
                  onStatusChange={(id, sid) => updateTask(id, { status_id: sid })}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      <TaskDetailDialog task={activeOpenTask} open={!!activeOpenTask} onOpenChange={(v) => !v && setOpenTask(null)} />
    </>
  );
}
