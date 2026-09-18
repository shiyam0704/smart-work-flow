import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCanManage } from "@/hooks/use-permissions";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, PriorityBadge, PriorityDot } from "@/components/app/StatusBadge";
import { useProjects } from "@/hooks/use-projects";
import { useClientsData } from "@/hooks/use-clients-data";
import { useDepartments } from "@/hooks/use-departments";
import { useEmployees } from "@/hooks/use-employees";
import { useTasks } from "@/hooks/use-tasks";
import { useProjectFields } from "@/hooks/use-project-fields";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { useAuth } from "@/hooks/use-auth";
import { useInvoices } from "@/hooks/use-invoices";
import { useInvoicePayments } from "@/hooks/use-invoice-payments";
import { formatINR } from "@/lib/format";

import { useTaskModal } from "@/components/app/NewTaskModal";
import { EditProjectModal } from "@/components/app/EditProjectModal";
import { InlineTaskEditor } from "@/components/app/InlineTaskEditor";
import { PaymentsButton } from "@/components/app/PaymentsCard";
import { ExpensesButton } from "@/components/app/ExpensesCard";
import { ProjectThreadButton } from "@/components/app/ProjectThreadButton";
import { TaskDetailDialog } from "@/components/app/TaskDetailDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TaskFilters, DEFAULT_TASK_FILTERS, type TaskFiltersValue } from "@/components/app/TaskFilters";
import { splitTasksByCompletion, matchesDeadline } from "@/lib/task-status";
import { ArrowLeft, Calendar, ChevronDown, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/c/$slug/_app/projects/$projectId")({
  component: ProjectDetail,
});

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not yet started",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { getProject, loading, deleteProject } = useProjects();
  const navigate = useNavigate();

  const { clients } = useClientsData();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { tasks, updateTask } = useTasks();
  const { fields } = useProjectFields();
  const { states } = useWorkflowStates();
  const { isAdmin } = useAuth();
  const isManager = useCanManage("projects");
  const { open: openTask } = useTaskModal();
  const [editOpen, setEditOpen] = useState(false);

  const project = getProject(projectId);
  const client = useMemo(() => clients.find((c) => c.id === project?.client_id), [clients, project]);
  const subscribed = useMemo(
    () => departments.filter((d) => project?.department_ids.includes(d.id)),
    [departments, project],
  );
  const projectTasks = useMemo(
    () => tasks.filter((t) => Boolean(projectId) && Boolean(t.project_id) && t.project_id === projectId),
    [tasks, projectId]
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="w-5 h-5 animate-pulse mr-2" /> Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Link to="/c/$slug/projects" className="text-neon-cyan hover:underline">Back to projects</Link>
      </div>
    );
  }

  return (
    <>
      <Topbar title={project.name} subtitle={client ? `${client.name} · Project` : "Project"} />
      <div className="p-4 sm:p-6 space-y-6">
        <Link to="/c/$slug/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All projects
        </Link>

        <div className="glass-strong rounded-2xl p-4 sm:p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-muted-foreground">{STATUS_LABEL[project.status] ?? project.status}</span>
                <PriorityBadge priority={project.priority ?? "medium"} />
                {client && (
                  <Link to="/c/$slug/clients/$clientId" params={{ clientId: client.id }} className="text-xs text-muted-foreground hover:text-foreground truncate">
                    {client.name}
                  </Link>
                )}
              </div>
              <h2 className="font-display font-bold text-xl sm:text-2xl break-words">{project.name}</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 shrink-0" />Start: {project.start_date ?? "—"}</div>
                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 shrink-0" />Deadline: {project.deadline_date ?? "—"}</div>
              </div>
              {fields.length > 0 && Object.keys(project.custom_fields ?? {}).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {fields.map((f) => {
                    const v = project.custom_fields?.[f.label];
                    if (v === undefined || v === null || v === "") return null;
                    return (
                      <div key={f.id} className="glass px-2.5 py-1 rounded-md">
                        <span className="text-muted-foreground">{f.label}: </span>
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:shrink-0">
              <PaymentsButton
                projectId={project.id}
                finalPrice={project.final_price}
                quotedPrice={project.quoted_price}
              />
              <ExpensesButton projectId={project.id} clientId={project.client_id} />
              <ProjectThreadButton projectId={project.id} projectName={project.name} />
              {isManager && (
                <Button onClick={() => setEditOpen(true)} variant="outline" className="glass border-glass-border">
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
              )}

              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Delete project" className="glass border-glass-border text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deleting "{project.name}" will not delete tasks linked to it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteProject(project.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        <ProjectInvoicing projectId={project.id} />


        {subscribed.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="text-muted-foreground mb-2">No departments are subscribed to this project yet.</p>
            {isManager && (
              <Button onClick={() => setEditOpen(true)} variant="outline" className="glass border-glass-border">
                <Pencil className="w-4 h-4" /> Edit project
              </Button>
            )}
          </div>
        ) : (
          <ProjectTaskList
            projectTasks={projectTasks}
            subscribed={subscribed}
            departments={departments}
            employees={employees}
            states={states}
            project={project}
            updateTask={updateTask}
            openTask={openTask}
          />
        )}
      </div>

      <EditProjectModal open={editOpen} onOpenChange={setEditOpen} project={project} clientId={project.client_id} />
    </>
  );
}

/** Invoices raised against this project, with what has been received. */
function ProjectInvoicing({ projectId }: { projectId: string }) {
  const { invoices } = useInvoices({ projectId });
  const { paidFor } = useInvoicePayments();
  if (invoices.length === 0) return null;
  const billed = invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.grand_total, 0);
  const received = invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + paidFor(i.id), 0);
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-glass-border">
        <h3 className="font-display font-semibold">Invoicing</h3>
        <div className="text-sm text-muted-foreground">
          Billed {formatINR(billed)} · Received {formatINR(received)} · Balance{" "}
          <span className="font-semibold text-foreground">{formatINR(billed - received)}</span>
        </div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className="border-b border-glass-border/60 last:border-0">
              <td className="px-4 py-2 font-medium whitespace-nowrap">{i.invoice_no}</td>
              <td className="px-4 py-2 text-muted-foreground">{i.bill_to_name}</td>
              <td className="px-4 py-2 text-right">{formatINR(i.grand_total)}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{formatINR(paidFor(i.id))}</td>
              <td className="px-4 py-2 text-right font-semibold">{formatINR(i.grand_total - paidFor(i.id))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTaskList({

  projectTasks,
  subscribed,
  departments,
  employees,
  states,
  project,
  updateTask,
  openTask,
}: {
  projectTasks: ReturnType<typeof useTasks>["tasks"];
  subscribed: ReturnType<typeof useDepartments>["departments"];
  departments: ReturnType<typeof useDepartments>["departments"];
  employees: ReturnType<typeof useEmployees>["employees"];
  states: ReturnType<typeof useWorkflowStates>["states"];
  project: { id: string; client_id: string };
  updateTask: ReturnType<typeof useTasks>["updateTask"];
  openTask: ReturnType<typeof useTaskModal>["open"];
}) {
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [filters, setFilters] = useState<TaskFiltersValue>(DEFAULT_TASK_FILTERS);
  const [detailTask, setDetailTask] = useState<typeof projectTasks[number] | null>(null);

  const filtered = useMemo(() => {
    return projectTasks.filter((t) => {
      if (deptFilter !== "all" && t.department_id !== deptFilter) return false;
      if (filters.status !== "all" && t.status_id !== filters.status) return false;
      if (!matchesDeadline(t.due_date, filters.deadline)) return false;
      return true;
    });
  }, [projectTasks, deptFilter, filters]);

  const { active, completed } = splitTasksByCompletion(filtered, states);

  const defaultDeptForNew = deptFilter !== "all" ? deptFilter : subscribed[0]?.id;

  const renderRow = (t: typeof filtered[number], dim = false) => {
    const d = departments.find((x) => x.id === t.department_id);
    const assignees = t.assignee_ids.map((id) => employees.find((e) => e.id === id)).filter(Boolean);
    return (
      <div key={t.id} className={`p-3 sm:p-4 hover:bg-white/5 transition ${dim ? "opacity-80" : ""}`}>
        {/* Desktop layout */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="w-1 h-12 rounded-full shrink-0" style={{ background: d?.color ?? "var(--muted)" }} />
          <button type="button" onClick={() => setDetailTask(t)} className="flex-1 min-w-0 text-left">
            <div className="font-medium truncate hover:underline">{t.title}</div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
              {d && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
              )}
              {t.description && <span className="truncate">· {t.description}</span>}
            </div>
          </button>
          <div className="hidden md:flex items-center -space-x-2">
            {assignees.map((a) => a && (
              <div key={a.id} className="w-7 h-7 rounded-full bg-gradient-primary border-2 border-background flex items-center justify-center text-[10px] font-bold text-white">{a.avatar}</div>
            ))}
          </div>
          <PriorityBadge priority={t.priority} />
          <StatusBadge statusId={t.status_id} onChange={(sid) => updateTask(t.id, { status_id: sid })} />
          <div className="hidden lg:block text-xs text-muted-foreground w-20 text-right">{t.due_date ?? "—"}</div>
          <InlineTaskEditor task={t} />
        </div>
        {/* Mobile layout */}
        <div className="sm:hidden flex items-start gap-3">
          <div className="w-1 h-10 rounded-full shrink-0 mt-0.5" style={{ background: d?.color ?? "var(--muted)" }} />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => setDetailTask(t)} className="flex-1 min-w-0 text-left font-medium truncate hover:underline">
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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-9 w-[200px] bg-input border-border">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {subscribed.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TaskFilters value={filters} onChange={setFilters} />
        </div>
        <Button
          onClick={() => defaultDeptForNew && openTask({ clientId: project.client_id, deptId: defaultDeptForNew, projectId: project.id })}
          className="bg-gradient-primary text-white shadow-glow"
          disabled={!defaultDeptForNew}
        >
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          No tasks match these filters.
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
              All tasks completed.
            </div>
          ) : (
            <div className="glass rounded-2xl divide-y divide-glass-border overflow-hidden">
              {active.map((t) => renderRow(t))}
            </div>
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
              <CollapsibleContent>
                <div className="glass rounded-2xl divide-y divide-glass-border overflow-hidden">
                  {completed.map((t) => renderRow(t, true))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
      <TaskDetailDialog task={detailTask} open={!!detailTask} onOpenChange={(v) => !v && setDetailTask(null)} />
    </div>
  );
}
