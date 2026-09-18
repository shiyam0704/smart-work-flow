import { createFileRoute } from "@tanstack/react-router";
import { useCanManage } from "@/hooks/use-permissions";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { EmployeePhoto } from "@/components/app/EmployeePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Search, Phone, Pencil, Loader2, X } from "lucide-react";
import { EditEmployeeModal } from "@/components/app/EditEmployeeModal";
import { ViewToggle, useViewMode } from "@/components/app/ViewToggle";
import { useEmployees, type EmployeeRow, type EmployeeInput } from "@/hooks/use-employees";
import { useDepartments } from "@/hooks/use-departments";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/components/app/confirm-dialog";
import { useServerFn } from "@tanstack/react-start";
import { deleteEmployeeLogin } from "@/lib/employee-auth.functions";
import { toast } from "sonner";
import { CNavigate } from "@/lib/nav";

export const Route = createFileRoute("/c/$slug/_app/employees")({
  component: () => <EmployeesGate />,
  head: () => ({ meta: [{ title: "Employees — Smart Work Flow" }] }),
});

function EmployeesGate() {
  const { loading, canAccessEmployees } = useAuth();
  if (loading) return null;
  if (!canAccessEmployees) return <CNavigate to="/c/$slug/dashboard" replace />;
  return <EmployeesPage />;
}

function EmployeesPage() {
  const { employees, loading, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { departments } = useDepartments();
  const { isAdmin } = useAuth();
  const isManager = useCanManage("employees");
  const confirm = useConfirm();
  const deleteLoginFn = useServerFn(deleteEmployeeLogin);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [query, setQuery] = useState("");
  const [view, setView] = useViewMode("employees:view");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const e of employees) {
      const r = (e.role || "").trim();
      if (r) set.set(r.toLowerCase(), r);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filtersActive = query.trim() !== "" || roleFilter !== "all" || deptFilter !== "all";

  const filtered = employees.filter((e) => {
    const q = query.trim().toLowerCase();
    if (q && !(e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.role.toLowerCase().includes(q))) return false;
    if (roleFilter !== "all" && (e.role || "").toLowerCase() !== roleFilter.toLowerCase()) return false;
    if (deptFilter !== "all") {
      if (deptFilter === "__none") {
        if (e.department_id) return false;
      } else if (e.department_id !== deptFilter) return false;
    }
    return true;
  });


  const handleEdit = (e: EmployeeRow) => {
    setEditing(e);
    setMode("edit");
    setOpen(true);
  };
  const handleAdd = () => {
    setEditing(null);
    setMode("create");
    setOpen(true);
  };
  const handleSave = async (input: EmployeeInput, id?: string) => {
    return id ? updateEmployee(id, input) : addEmployee(input);
  };

  const handleDeleteEmployee = async (id: string) => deleteEmployee(id);

  const handleCardDelete = async (e: EmployeeRow) => {
    const ok = await confirm({
      title: `Delete ${e.name}?`,
      description: e.user_id
        ? "This will permanently delete the employee and remove their login account. This cannot be undone."
        : "This will permanently delete the employee. This cannot be undone.",
      confirmText: "Delete employee",
      destructive: true,
      requireType: e.name,
    });
    if (!ok) return;
    setDeletingId(e.id);
    try {
      if (e.user_id) {
        try {
          await deleteLoginFn({ data: { userId: e.user_id } });
        } catch (err: any) {
          toast.error(err?.message ?? "Failed to remove login account");
          return;
        }
      }
      await deleteEmployee(e.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Topbar title="Employees" subtitle={loading ? "Loading…" : `${employees.length} team members`} />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees…"
              className="bg-transparent border-0 h-7 px-0 focus-visible:ring-0"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="glass border-glass-border h-10 w-[160px]"><SelectValue placeholder="All roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleOptions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="glass border-glass-border h-10 w-[200px]"><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              <SelectItem value="__none">Unassigned</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtersActive && (
            <button
              onClick={() => { setQuery(""); setRoleFilter("all"); setDeptFilter("all"); }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
          <Button variant="outline" className="glass border-glass-border"><Upload className="w-4 h-4" /> CSV Import</Button>
          {isManager && (
            <Button onClick={handleAdd} className="bg-gradient-primary text-white shadow-glow"><Plus className="w-4 h-4" /> Add Employee</Button>
          )}
          <ViewToggle value={view} onChange={setView} />
        </div>

        {!loading && employees.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No employees yet. {isManager ? 'Click "Add Employee" to add one.' : "Ask an admin to add team members."}
          </div>
        )}

        {view === "grid" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((e) => {
            const d = departments.find((x) => x.id === e.department_id);
            const isDeleting = deletingId === e.id;
            return (
              <div key={e.id} className="glass rounded-2xl p-5 shadow-card hover:shadow-glow transition group relative">
                {isManager && (
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleEdit(e)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground"
                      aria-label={`Edit ${e.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center text-white font-bold shadow-glow overflow-hidden">
                    {e.photo_url ? <EmployeePhoto photoRef={e.photo_url} alt={e.name} className="w-full h-full object-cover" fallback={<span>{e.avatar}</span>} /> : e.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{e.role || "—"}</div>
                    {e.employee_code && (
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 truncate">
                        {e.employee_code}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  {d ? (
                    <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: `color-mix(in oklch, ${d.color} 18%, transparent)`, color: d.color }}>{d.name}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No department</span>
                  )}
                  {e.contact_number ? (
                    <a
                      href={`tel:${e.contact_number}`}
                      className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground"
                      aria-label={`Call ${e.name}`}
                      title={e.contact_number}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {view === "table" && filtered.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Employee</th>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Role</th>
                    <th className="text-left px-4 py-3 font-medium">Department</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    {isManager && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const d = departments.find((x) => x.id === e.department_id);
                    return (
                      <tr key={e.id} className="border-t border-glass-border hover:bg-white/5 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center text-white text-xs font-bold shadow-glow overflow-hidden shrink-0">
                              {e.photo_url ? (
                                <EmployeePhoto photoRef={e.photo_url} alt={e.name} className="w-full h-full object-cover" fallback={<span>{e.avatar}</span>} />
                              ) : (
                                e.avatar
                              )}
                            </div>
                            <span className="font-medium truncate">{e.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{e.employee_code || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.role || "—"}</td>
                        <td className="px-4 py-3">
                          {d ? (
                            <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: `color-mix(in oklch, ${d.color} 18%, transparent)`, color: d.color }}>{d.name}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[220px]">{e.email || "—"}</td>
                        <td className="px-4 py-3">
                          {e.contact_number ? (
                            <a href={`tel:${e.contact_number}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5" /> {e.contact_number}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md ${e.status === "active" ? "bg-success/15 text-success" : "bg-white/10 text-muted-foreground"}`}>
                            {e.status}
                          </span>
                        </td>
                        {isManager && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleEdit(e)}
                              className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground"
                              aria-label={`Edit ${e.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <EditEmployeeModal
        employee={editing}
        departments={departments}
        mode={mode}
        open={open}
        onOpenChange={setOpen}
        onSave={handleSave}
        onDelete={isAdmin ? handleDeleteEmployee : undefined}
      />
    </>
  );
}
