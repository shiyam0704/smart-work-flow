import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCanManage } from "@/hooks/use-permissions";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { useClientsData, type ClientInput } from "@/hooks/use-clients-data";
import { useDepartments } from "@/hooks/use-departments";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects, type ProjectRow } from "@/hooks/use-projects";
import { useProjectPayments } from "@/hooks/use-project-payments";
import { useExpenses } from "@/hooks/use-expenses";
import { formatINR } from "@/lib/format";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, MapPin, Tag, Pencil, Sparkles, Trash2, FolderKanban, ChevronRight, Phone, MessageCircle, User, StickyNote } from "lucide-react";
import { useTaskModal } from "@/components/app/NewTaskModal";
import { EditClientModal } from "@/components/app/EditClientModal";
import { EditProjectModal } from "@/components/app/EditProjectModal";
import { useClientFields } from "@/hooks/use-client-fields";
import { splitTasksByCompletion } from "@/lib/task-status";
import { parseISO, isBefore, startOfToday } from "date-fns";

export const Route = createFileRoute("/c/$slug/_app/clients/$clientId")({
  component: ClientDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p className="text-muted-foreground">Client not found.</p>
      <Link to="/c/$slug/clients" className="text-neon-cyan hover:underline">Back to clients</Link>
    </div>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not yet started",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const { getClient, updateClient, deleteClient, loading } = useClientsData();
  const { departments } = useDepartments();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const { states } = useWorkflowStates();
  const { isAdmin, canViewFinancials } = useAuth();
  const isManager = useCanManage("clients");
  const { open: openTask } = useTaskModal();
  const { fields: customFields } = useClientFields();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | undefined>(undefined);

  const client = getClient(clientId);
  const waDigits = (client?.contact_number ?? "").replace(/\D/g, "");
  const clientProjects = useMemo(
    () =>
      projects
        .filter((p) => p.client_id === clientId)
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [projects, clientId],
  );

  const { payments: allPayments } = useProjectPayments();
  const { all: allExpenses } = useExpenses();
  const clientExpenses = useMemo(() => {
    const ids = new Set(clientProjects.map((p) => p.id));
    return allExpenses.filter((e) => e.client_id === clientId || (e.project_id && ids.has(e.project_id)));
  }, [allExpenses, clientProjects, clientId]);
  const totalExpenses = useMemo(
    () => clientExpenses.reduce((s, e) => s + e.amount, 0),
    [clientExpenses],
  );
  const { totalValue, totalPaid, totalDue } = useMemo(() => {
    const ids = new Set(clientProjects.map((p) => p.id));
    const tv = clientProjects.reduce((s, p) => s + (p.final_price ?? p.quoted_price ?? 0), 0);
    const tp = allPayments.filter((pay) => ids.has(pay.project_id)).reduce((s, p) => s + p.amount, 0);
    return { totalValue: tv, totalPaid: tp, totalDue: Math.max(0, tv - tp) };
  }, [clientProjects, allPayments]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="w-5 h-5 animate-pulse mr-2" /> Loading client…
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Client not found.</p>
        <Link to="/c/$slug/clients" className="text-neon-cyan hover:underline">Back to clients</Link>
      </div>
    );
  }

  const handleSave = (input: ClientInput, id?: string) => updateClient(id!, input);

  const handleDelete = async () => {
    const ok = await deleteClient(client.id);
    if (ok) navigate({ to: "/c/$slug/clients" });
  };

  const openNewProject = () => {
    setEditingProject(undefined);
    setProjectModalOpen(true);
  };

  const openEditProject = (p: ProjectRow) => {
    setEditingProject(p);
    setProjectModalOpen(true);
  };

  const today = startOfToday();

  return (
    <>
      <Topbar title={client.name} subtitle="Client 360°" />
      <div className="p-4 md:p-6 space-y-6">
        <Link to="/c/$slug/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All clients
        </Link>

        <div className="glass-strong rounded-2xl p-4 md:p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-accent flex items-center justify-center text-white font-display font-bold text-2xl md:text-3xl shadow-glow overflow-hidden shrink-0">
              {client.logo_url ? (
                <img src={client.logo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : client.logo}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-xl md:text-2xl">{client.name}</h2>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {client.city && <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-4 h-4" />{client.city}</div>}
                <div className="flex items-center gap-1.5 text-muted-foreground"><Tag className="w-4 h-4" />{client.client_group}</div>
                {client.contact_person && <div className="flex items-center gap-1.5 text-muted-foreground"><User className="w-4 h-4" />{client.contact_person}</div>}
                {client.contact_number && (
                  <div className="flex items-center gap-1.5">
                    <a href={`tel:${client.contact_number}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Phone className="w-4 h-4" />{client.contact_number}</a>
                    {waDigits && (
                      <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300" aria-label="WhatsApp"><MessageCircle className="w-4 h-4" /></a>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isManager && (
                <Button onClick={() => setEditOpen(true)} variant="outline" className="glass border-glass-border">
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
              )}
              {isAdmin && (
                <Button onClick={() => setDeleteOpen(true)} variant="outline" className="glass border-glass-border text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
              <Button onClick={() => openTask({ clientId: client.id })} className="bg-gradient-primary text-white shadow-glow">
                <Plus className="w-4 h-4" /> New Task
              </Button>
            </div>
          </div>
        </div>

        {(client.address || client.note || customFields.some((f) => (client.custom_fields ?? {})[f.id] !== undefined && (client.custom_fields ?? {})[f.id] !== "")) && (
          <section className="glass rounded-2xl p-4 md:p-6 shadow-card space-y-4">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wide">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {client.address && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Address</div>
                  <div className="whitespace-pre-line">{client.address}</div>
                </div>
              )}
              {client.note && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> Note</div>
                  <div className="whitespace-pre-line">{client.note}</div>
                </div>
              )}
              {customFields
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((f) => {
                  const v = (client.custom_fields ?? {})[f.id];
                  if (v === undefined || v === null || v === "") return null;
                  let display: string;
                  if (typeof v === "boolean") display = v ? "Yes" : "No";
                  else display = String(v);
                  return (
                    <div key={f.id} className="space-y-1">
                      <div className="text-xs text-muted-foreground">{f.label}</div>
                      <div className="break-words">{display}</div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {canViewFinancials && clientProjects.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-4 shadow-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Value</div>
              <div className="font-display font-bold text-lg sm:text-xl mt-1 tabular-nums">{formatINR(totalValue)}</div>
            </div>
            <div className="glass rounded-2xl p-4 shadow-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Paid</div>
              <div className="font-display font-bold text-lg sm:text-xl mt-1 text-success tabular-nums">{formatINR(totalPaid)}</div>
            </div>
            {totalDue > 0 && (
              <div className="glass rounded-2xl p-4 shadow-card">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Due</div>
                <div className="font-display font-bold text-lg sm:text-xl mt-1 text-destructive tabular-nums">{formatINR(totalDue)}</div>
              </div>
            )}
            {totalExpenses > 0 && (
              <div className="glass rounded-2xl p-4 shadow-card">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</div>
                <div className="font-display font-bold text-lg sm:text-xl mt-1 text-warning tabular-nums">{formatINR(totalExpenses)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {clientExpenses.length} entr{clientExpenses.length === 1 ? "y" : "ies"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-neon-cyan" /> Projects
              <span className="text-sm text-muted-foreground font-normal">({clientProjects.length})</span>
            </h3>
            {isManager && (
              <Button onClick={openNewProject} size="sm" className="bg-gradient-primary text-white shadow-glow">
                <Plus className="w-4 h-4" /> New Project
              </Button>
            )}
          </div>

          {clientProjects.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-muted-foreground mb-3">No projects yet for this client.</p>
              {isManager && (
                <Button onClick={openNewProject} variant="outline" className="glass border-glass-border">
                  <Plus className="w-4 h-4" /> Create first project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {clientProjects.map((p) => {
                const projTasks = tasks.filter((t) => Boolean(p.id) && Boolean(t.project_id) && t.project_id === p.id);
                const total = projTasks.length;
                const { completed } = splitTasksByCompletion(projTasks, states);
                const done = completed.length;
                const open = total - done;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                const deptDots = departments.filter((d) => p.department_ids.includes(d.id));
                const overdue =
                  !!p.deadline_date &&
                  p.status !== "completed" &&
                  isBefore(parseISO(p.deadline_date), today);

                return (
                  <div key={p.id} className="glass rounded-2xl p-4 hover:bg-white/5 transition group">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/c/$slug/projects/$projectId"
                        params={{ projectId: p.id }}
                        className="flex-1 min-w-0"
                      >
                        <div className="font-medium truncate group-hover:text-neon-cyan transition flex items-center gap-1">
                          {p.name} <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                          {p.deadline_date && (
                            <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
                              Due {p.deadline_date}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {done}/{total} done · {open} open
                            </span>
                            <span className="font-medium tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {deptDots.length > 0 && (
                          <div className="mt-3 flex items-center gap-1">
                            {deptDots.map((d) => (
                              <span key={d.id} title={d.name} className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                            ))}
                          </div>
                        )}
                      </Link>
                      {isManager && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => openEditProject(p)}
                          aria-label="Edit project"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <EditClientModal
        client={client}
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSave}
      />

      <EditProjectModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        project={editingProject}
        clientId={client.id}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{client.name}</strong>. Related projects and tasks will remain but lose their client reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
