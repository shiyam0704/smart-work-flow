import { useEffect, useMemo } from "react";
import { useCNavigate as useNavigate } from "@/lib/nav";
import { Users, Briefcase, CheckSquare, Sparkles, UserCircle2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useClientsData } from "@/hooks/use-clients-data";
import { useTasks } from "@/hooks/use-tasks";
import { useEmployees } from "@/hooks/use-employees";
import { useLeads } from "@/hooks/use-leads";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-permissions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CAP = 6;

export function GlobalSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { clients } = useClientsData();
  const { tasks } = useTasks();
  const { employees } = useEmployees();
  const { leads } = useLeads();
  const { projects } = useProjects();
  const { isAdmin, roles, canAccessLeads, canAccessEmployees } = useAuth();
  const { isAllowed } = useRolePermissions();

  const permitted = (perm: string) => isAdmin || roles.some((r) => isAllowed(r, perm));
  const canClients = permitted("nav.clients");
  const canProjects = permitted("nav.projects");
  const canLeads = permitted("nav.leads") || canAccessLeads;
  const canTasks = permitted("nav.tasks");
  const canEmployees = permitted("nav.employees") || canAccessEmployees;

  // Global keyboard shortcut: Cmd/Ctrl+K toggles; "/" opens when not typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (t && t.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const clientsCapped = useMemo(() => clients.slice(0, 200), [clients]);
  const tasksCapped = useMemo(() => tasks.slice(0, 200), [tasks]);
  const employeesCapped = useMemo(() => employees.slice(0, 200), [employees]);
  const leadsCapped = useMemo(() => leads.slice(0, 200), [leads]);
  const projectsCapped = useMemo(() => projects.slice(0, 200), [projects]);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name);
    return m;
  }, [clients]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search clients, tasks, employees, leads, projects…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {canClients && (
          <CommandGroup heading="Clients">
            {clientsCapped.slice(0, CAP * 4).map((c) => (
              <CommandItem
                key={`c-${c.id}`}
                value={`client ${c.name} ${c.contact_person} ${c.city}`}
                onSelect={() =>
                  go(() => navigate({ to: "/c/$slug/clients/$clientId", params: { clientId: c.id } }))
                }
              >
                <Users className="opacity-60" />
                <span className="truncate">{c.name}</span>
                {c.contact_person && (
                  <span className="ml-auto text-xs text-muted-foreground truncate">
                    {c.contact_person}
                  </span>
                )}
              </CommandItem>
            ))}
            {clients.length > CAP * 4 && (
              <CommandItem onSelect={() => go(() => navigate({ to: "/c/$slug/clients" }))} className="text-xs text-muted-foreground justify-center">
                + {clients.length - CAP * 4} more clients…
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {canProjects && (
          <CommandGroup heading="Projects">
            {projectsCapped.slice(0, CAP * 4).map((p) => {
              const clientName = clientNameById.get(p.client_id) ?? "";
              return (
                <CommandItem
                  key={`p-${p.id}`}
                  value={`project ${p.name} ${clientName}`}
                  onSelect={() =>
                    go(() =>
                      navigate({ to: "/c/$slug/projects/$projectId", params: { projectId: p.id } }),
                    )
                  }
                >
                  <Briefcase className="opacity-60" />
                  <span className="truncate">{p.name}</span>
                  {clientName && (
                    <span className="ml-auto text-xs text-muted-foreground truncate">
                      {clientName}
                    </span>
                  )}
                </CommandItem>
              );
            })}
            {projects.length > CAP * 4 && (
              <CommandItem onSelect={() => go(() => navigate({ to: "/c/$slug/projects" }))} className="text-xs text-muted-foreground justify-center">
                + {projects.length - CAP * 4} more projects…
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {canLeads && (
          <CommandGroup heading="Leads">
            {leadsCapped.slice(0, CAP * 4).map((l) => (
              <CommandItem
                key={`l-${l.id}`}
                value={`lead ${l.company_name} ${l.contact_person} ${l.city}`}
                onSelect={() =>
                  go(() => navigate({ to: "/c/$slug/leads/$leadId", params: { leadId: l.id } }))
                }
              >
                <Sparkles className="opacity-60" />
                <span className="truncate">{l.company_name}</span>
                {l.contact_person && (
                  <span className="ml-auto text-xs text-muted-foreground truncate">
                    {l.contact_person}
                  </span>
                )}
              </CommandItem>
            ))}
            {leads.length > CAP * 4 && (
              <CommandItem onSelect={() => go(() => navigate({ to: "/c/$slug/leads" }))} className="text-xs text-muted-foreground justify-center">
                + {leads.length - CAP * 4} more leads…
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {canTasks && (
          <CommandGroup heading="Tasks">
            {tasksCapped.slice(0, CAP * 4).map((t) => (
              <CommandItem
                key={`t-${t.id}`}
                value={`task ${t.title}`}
                onSelect={() => go(() => navigate({ to: "/c/$slug/tasks" }))}
              >
                <CheckSquare className="opacity-60" />
                <span className="truncate">{t.title || "(untitled task)"}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {t.priority}
                </span>
              </CommandItem>
            ))}
            {tasks.length > CAP * 4 && (
              <CommandItem onSelect={() => go(() => navigate({ to: "/c/$slug/tasks" }))} className="text-xs text-muted-foreground justify-center">
                + {tasks.length - CAP * 4} more tasks…
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {canEmployees && (
          <CommandGroup heading="Employees">
            {employeesCapped.slice(0, CAP * 4).map((e) => (
              <CommandItem
                key={`e-${e.id}`}
                value={`employee ${e.name} ${e.role} ${e.email}`}
                onSelect={() => go(() => navigate({ to: "/c/$slug/employees" }))}
              >
                <UserCircle2 className="opacity-60" />
                <span className="truncate">{e.name}</span>
                {e.role && (
                  <span className="ml-auto text-xs text-muted-foreground truncate">
                    {e.role}
                  </span>
                )}
              </CommandItem>
            ))}
            {employees.length > CAP * 4 && (
              <CommandItem onSelect={() => go(() => navigate({ to: "/c/$slug/employees" }))} className="text-xs text-muted-foreground justify-center">
                + {employees.length - CAP * 4} more employees…
              </CommandItem>
            )}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
