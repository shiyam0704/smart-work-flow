import { createFileRoute } from "@tanstack/react-router";
import { useCanManage } from "@/hooks/use-permissions";
import { CLink as Link } from "@/lib/nav";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useProjects } from "@/hooks/use-projects";
import { useClientsData } from "@/hooks/use-clients-data";
import { useClientGroups } from "@/hooks/use-client-groups";
import { useTasks } from "@/hooks/use-tasks";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { EditProjectModal } from "@/components/app/EditProjectModal";
import { PriorityBadge } from "@/components/app/StatusBadge";
import { Plus, Calendar, FolderKanban, Check, ChevronsUpDown, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ViewToggle, useViewMode } from "@/components/app/ViewToggle";
import { cn } from "@/lib/utils";
import { splitTasksByCompletion } from "@/lib/task-status";
import { parseISO, isBefore, startOfToday } from "date-fns";


export const Route = createFileRoute("/c/$slug/_app/projects/")({
  component: ProjectsIndex,
  head: () => ({ meta: [{ title: "Projects — Smart Work Flow" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not yet started",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

function ProjectsIndex() {
  const { projects, loading } = useProjects();
  const { clients } = useClientsData();
  const { groups } = useClientGroups();
  const { tasks } = useTasks();
  const { states } = useWorkflowStates();
  const isManager = useCanManage("projects");

  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [view, setView] = useViewMode("projects:view");

  const clientsInGroup = useMemo(
    () => (groupFilter === "all" ? clients : clients.filter((c) => c.client_group === groupFilter)),
    [clients, groupFilter],
  );

  const filtered = useMemo(() => {
    const allowedClientIds = new Set(clientsInGroup.map((c) => c.id));
    return projects.filter((p) => {
      if (groupFilter !== "all" && !allowedClientIds.has(p.client_id)) return false;
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [projects, q, clientFilter, statusFilter, groupFilter, clientsInGroup]);

  const selectedClientName =
    clientFilter === "all" ? "All clients" : clients.find((c) => c.id === clientFilter)?.name ?? "All clients";

  const handleGroupChange = (val: string) => {
    setGroupFilter(val);
    if (val !== "all" && clientFilter !== "all") {
      const c = clients.find((x) => x.id === clientFilter);
      if (!c || c.client_group !== val) setClientFilter("all");
    }
  };

  return (
    <>
      <Topbar title="Projects" subtitle="Group tasks across departments under a client engagement" />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search projects…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-input border-border max-w-xs"
          />
          <Select value={groupFilter} onValueChange={handleGroupChange}>
            <SelectTrigger className="w-44 bg-input border-border"><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={clientPickerOpen}
                className="w-56 justify-between bg-input border-border font-normal"
              >
                <span className="truncate">{selectedClientName}</span>
                <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search clients…" />
                <CommandList>
                  <CommandEmpty>No clients found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="All clients"
                      onSelect={() => { setClientFilter("all"); setClientPickerOpen(false); }}
                    >
                      <Check className={cn("w-4 h-4 mr-2", clientFilter === "all" ? "opacity-100" : "opacity-0")} />
                      All clients
                    </CommandItem>
                    {clientsInGroup.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => { setClientFilter(c.id); setClientPickerOpen(false); }}
                      >
                        <Check className={cn("w-4 h-4 mr-2", clientFilter === c.id ? "opacity-100" : "opacity-0")} />
                        {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-input border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <ViewToggle value={view} onChange={setView} />
          {isManager && (
            <Button onClick={() => setNewOpen(true)} className="bg-gradient-primary text-white shadow-glow">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          )}
        </div>

        {(() => {
          if (loading) {
            return <div className="text-sm text-muted-foreground">Loading projects…</div>;
          }
          const closed = filtered.filter((p) => p.status === "completed" || p.status === "archived");
          const openList = filtered.filter((p) => !(p.status === "completed" || p.status === "archived"));

          const renderCard = (p: typeof filtered[number]) => {
            const client = clients.find((c) => c.id === p.client_id);
            const projTasks = tasks.filter((t) => Boolean(p.id) && Boolean(t.project_id) && t.project_id === p.id);
            const total = projTasks.length;
            const { completed } = splitTasksByCompletion(projTasks, states);
            const done = completed.length;
            const open = total - done;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            const today = startOfToday();
            const overdue =
              !!p.deadline_date &&
              p.status !== "completed" &&
              isBefore(parseISO(p.deadline_date), today);
            return (
              <Link
                key={p.id}
                to="/c/$slug/projects/$projectId"
                params={{ projectId: p.id }}
                className="glass rounded-2xl p-5 shadow-card hover:shadow-glow transition group"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-muted-foreground">{STATUS_LABEL[p.status] ?? p.status}</span>
                    <PriorityBadge priority={p.priority ?? "medium"} />
                  </div>
                  <span className="text-xs text-muted-foreground truncate ml-2">{client?.name ?? "—"}</span>
                </div>
                <h3 className="font-display font-bold text-lg group-hover:text-neon-cyan transition mb-2 truncate">{p.name}</h3>
                <div className={cn("text-xs flex items-center gap-1.5 mb-3", overdue ? "text-destructive" : "text-muted-foreground")}>
                  <Calendar className="w-3.5 h-3.5" />
                  Start {p.start_date ?? "—"} → Due {p.deadline_date ?? "—"}
                </div>
                <div className="space-y-1.5">
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
              </Link>
            );
          };

          if (filtered.length === 0) {
            return (
              <div className="glass rounded-2xl p-10 text-center">
                <FolderKanban className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No projects yet.</p>
                {isManager && (
                  <Button onClick={() => setNewOpen(true)} variant="outline" className="glass border-glass-border">
                    <Plus className="w-4 h-4" /> Create your first project
                  </Button>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-5">
              {view === "table" ? (
                <ProjectsTable
                  rows={filtered}
                  clients={clients}
                  tasks={tasks}
                  states={states}
                />
              ) : openList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {openList.map(renderCard)}
                </div>
              ) : (
                closed.length > 0 && (
                  <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
                    No active projects.
                  </div>
                )
              )}

              {view === "grid" && closed.length > 0 && (
                <Collapsible className="space-y-3">
                  <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 p-4 glass rounded-2xl hover:bg-white/5 transition">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold">Closed</span>
                      <span className="text-xs text-muted-foreground">({closed.length})</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {closed.map(renderCard)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })()}
      </div>


      <EditProjectModal open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

function ProjectsTable({
  rows,
  clients,
  tasks,
  states,
}: {
  rows: ReturnType<typeof useProjects>["projects"];
  clients: ReturnType<typeof useClientsData>["clients"];
  tasks: ReturnType<typeof useTasks>["tasks"];
  states: ReturnType<typeof useWorkflowStates>["states"];
}) {
  return (
    <div className="glass rounded-2xl overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Project</th>
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">Start</th>
              <th className="text-left px-4 py-3 font-medium">Due</th>
              <th className="text-left px-4 py-3 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => {
                const client = clients.find((c) => c.id === p.client_id);
                const projTasks = tasks.filter((t) => Boolean(p.id) && Boolean(t.project_id) && t.project_id === p.id);
                const total = projTasks.length;
                const { completed } = splitTasksByCompletion(projTasks, states);
                const done = completed.length;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                const today = startOfToday();
                const overdue =
                  !!p.deadline_date &&
                  p.status !== "completed" &&
                  isBefore(parseISO(p.deadline_date), today);
                return (
                  <tr key={p.id} className="border-t border-glass-border hover:bg-white/5 transition">
                    <td className="px-4 py-3">
                      <Link
                        to="/c/$slug/projects/$projectId"
                        params={{ projectId: p.id }}
                        className="font-medium hover:text-neon-cyan transition"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                      {client?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-muted-foreground">
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={p.priority ?? "medium"} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.start_date ?? "—"}</td>
                    <td className={cn("px-4 py-3", overdue ? "text-destructive" : "text-muted-foreground")}>
                      {p.deadline_date ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
