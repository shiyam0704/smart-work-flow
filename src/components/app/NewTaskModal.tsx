import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useClientsData } from "@/hooks/use-clients-data";
import { useDepartments } from "@/hooks/use-departments";
import { useEmployees } from "@/hooks/use-employees";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { useProjects } from "@/hooks/use-projects";
import { useTasks, type TaskInput, type TaskRow, type RepeatRule } from "@/hooks/use-tasks";
import { useAuth } from "@/hooks/use-auth";
import { TaskAttachmentsField } from "@/components/app/TaskAttachmentsField";
import { uploadTaskAttachments } from "@/lib/task-attachments";
import { getDefaultActiveState } from "@/lib/task-status";

type OpenOpts = { clientId?: string; deptId?: string; projectId?: string; defaultAssigneeId?: string };
type Ctx = {
  open: (opts?: OpenOpts) => void;
  openEdit: (task: TaskRow) => void;
};
const TaskModalCtx = createContext<Ctx>({ open: () => {}, openEdit: () => {} });
export const useTaskModal = () => useContext(TaskModalCtx);

const emptyForm = (): TaskInput => ({
  title: "",
  description: "",
  client_id: null,
  department_id: null,
  project_id: null,
  status_id: "",
  priority: "medium",
  due_date: null,
  repeat_rule: "none",
  assignee_ids: [],
});

export function TaskModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [form, setForm] = useState<TaskInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [lockedProject, setLockedProject] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { user } = useAuth();
  const { clients } = useClientsData();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { states } = useWorkflowStates();
  const { projects } = useProjects();
  const { addTask, updateTask } = useTasks();

  const myEmployee = employees.find(
    (e) => (user?.id && e.user_id === user.id) || (user?.email && e.email?.toLowerCase() === user.email?.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && states.length && !editingTask) {
      const activeState = getDefaultActiveState(states);
      if (!form.status_id || !states.some((s) => s.id === form.status_id)) {
        setForm((f) => ({ ...f, status_id: activeState?.id ?? states[0].id }));
      }
    }
  }, [isOpen, states, form.status_id, editingTask]);

  const resetState = () => {
    setEditingTask(null);
    setForm(emptyForm());
    setPendingFiles([]);
    setLockedProject(false);
    setProjectPickerOpen(false);
    setClientPickerOpen(false);
    setAssigneePickerOpen(false);
  };

  const handleOpenChange = (openState: boolean) => {
    setIsOpen(openState);
    if (!openState) {
      resetState();
    }
  };

  const open = (opts: OpenOpts = {}) => {
    setEditingTask(null);
    const explicitProjectId = (opts.projectId && opts.projectId.trim() !== "") ? opts.projectId.trim() : null;
    const proj = explicitProjectId ? projects.find((p) => p.id === explicitProjectId) : undefined;
    const defaultState = getDefaultActiveState(states);
    const defaultAssignee = opts.defaultAssigneeId ?? myEmployee?.id;
    setForm({
      ...emptyForm(),
      client_id: proj?.client_id ?? opts.clientId ?? null,
      department_id: opts.deptId ?? null,
      project_id: explicitProjectId,
      status_id: defaultState?.id ?? "",
      due_date: proj?.deadline_date ?? null,
      assignee_ids: defaultAssignee ? [defaultAssignee] : [],
    });
    setPendingFiles([]);
    setLockedProject(Boolean(explicitProjectId));
    setIsOpen(true);
  };

  const openEdit = (task: TaskRow) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      client_id: task.client_id ?? null,
      department_id: task.department_id ?? null,
      project_id: task.project_id ?? null,
      status_id: task.status_id ?? "",
      priority: task.priority ?? "medium",
      due_date: task.due_date ?? null,
      repeat_rule: task.repeat_rule ?? "none",
      assignee_ids: [...task.assignee_ids],
    });
    setPendingFiles([]);
    setLockedProject(false);
    setIsOpen(true);
  };

  const selectedProject = form.project_id ? projects.find((p) => p.id === form.project_id) : null;
  const availableDepartments = selectedProject
    ? departments.filter((d) => selectedProject.department_ids.includes(d.id))
    : departments;

  const candidateProjects = form.client_id
    ? projects.filter((p) => p.client_id === form.client_id)
    : projects;

  const canSubmit = () => Boolean(form.title.trim());

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSaving(true);
    const activeState = getDefaultActiveState(states);
    const payload = {
      ...form,
      status_id: form.status_id || activeState?.id || null,
    };

    if (editingTask) {
      const ok = await updateTask(editingTask.id, payload);
      if (ok && pendingFiles.length) {
        await uploadTaskAttachments(editingTask.id, pendingFiles);
      }
      setSaving(false);
      if (ok) {
        handleOpenChange(false);
      }
    } else {
      const res = await addTask(payload);
      if (res && pendingFiles.length) {
        await uploadTaskAttachments(res, pendingFiles);
      }
      setSaving(false);
      if (res) {
        handleOpenChange(false);
      }
    }
  };

  return (
    <TaskModalCtx.Provider value={{ open, openEdit }}>
      {children}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-border bg-background p-0 sm:max-h-[90vh]">
          <DialogHeader className="border-b border-border px-4 py-4 pr-12 sm:px-6 sm:py-5">
            <DialogTitle className="font-display text-xl sm:text-2xl">
              {editingTask ? "Edit Task" : "New Task"}
            </DialogTitle>
            <DialogDescription>
              {editingTask
                ? "Update task details, assignments, or linked project."
                : "Add a task and optionally link it to a client, project, or department."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-5 overflow-y-auto px-4 py-5 scrollbar-thin sm:px-6">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Follow up with team"
                className="bg-input border-border"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="grid min-w-0 gap-2">
                <Label>Client</Label>
                <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      disabled={Boolean(form.project_id)}
                      className={cn("w-full min-w-0 bg-input border-border justify-between font-normal", !form.client_id && "text-muted-foreground")}
                    >
                      <span className="min-w-0 truncate">
                        {form.client_id
                          ? (clients.find((c) => c.id === form.client_id)?.name ?? "Select client")
                          : "No client"}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        {form.client_id && !form.project_id && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); setForm({ ...form, client_id: null }); }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command>
                      <CommandInput placeholder="Search client…" />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__ No client"
                            onSelect={() => {
                              setForm({ ...form, client_id: null });
                              setClientPickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !form.client_id ? "opacity-100" : "opacity-0")} />
                            No client
                          </CommandItem>
                          {clients.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setForm({ ...form, client_id: c.id });
                                setClientPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.client_id === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid min-w-0 gap-2">
                <Label>Project</Label>
                  <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        disabled={lockedProject}
                        className={cn("w-full min-w-0 bg-input border-border justify-between font-normal", !form.project_id && "text-muted-foreground")}
                      >
                        <span className="min-w-0 truncate">
                          {form.project_id
                            ? (() => {
                                const p = projects.find((x) => x.id === form.project_id);
                                const c = p && clients.find((x) => x.id === p.client_id);
                                return p ? `${c?.name ?? "Unknown"} — ${p.name}` : "Select project";
                              })()
                            : "No project"}
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          {form.project_id && !lockedProject && (
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); setForm({ ...form, project_id: null, department_id: null }); }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command>
                        <CommandInput placeholder="Search project or client…" />
                        <CommandList>
                          <CommandEmpty>No projects found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__none__ No project Standalone task"
                              onSelect={() => {
                                setForm({
                                  ...form,
                                  project_id: null,
                                  department_id: null,
                                });
                                setProjectPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", !form.project_id ? "opacity-100" : "opacity-0")} />
                              No project (Standalone task)
                            </CommandItem>
                            {candidateProjects.map((p) => {
                              const c = clients.find((x) => x.id === p.client_id);
                              const label = `${c?.name ?? "Unknown"} — ${p.name}`;
                              return (
                                <CommandItem
                                  key={p.id}
                                  value={label}
                                  onSelect={() => {
                                    setForm({
                                      ...form,
                                      project_id: p.id,
                                      client_id: p.client_id,
                                      department_id: null,
                                      due_date: form.due_date ?? p.deadline_date ?? null,
                                    });
                                    setProjectPickerOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", form.project_id === p.id ? "opacity-100" : "opacity-0")} />
                                  {label}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
              </div>

              <div className="grid min-w-0 gap-2">
                <Label>Department</Label>
                <Select
                  value={form.department_id ?? "__none__"}
                  onValueChange={(v) => setForm({ ...form, department_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger className="w-full min-w-0 bg-input border-border">
                    <SelectValue placeholder="No department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {availableDepartments.length === 0 && form.project_id && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No subscribed departments on this project</div>
                    )}
                    {availableDepartments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid min-w-0 gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, status_id: v })}
                >
                  <SelectTrigger className="w-full min-w-0 bg-input border-border">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {states.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No workflow states configured</div>
                    ) : (
                      states.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v: TaskInput["priority"]) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="w-full min-w-0 bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date ?? ""}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
                  className="w-full min-w-0 bg-input border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label>Repeat</Label>
                <Select
                  value={form.repeat_rule ?? "none"}
                  onValueChange={(v: RepeatRule) => setForm({ ...form, repeat_rule: v })}
                >
                  <SelectTrigger className="w-full min-w-0 bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>Assignee</Label>
                <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn("w-full min-w-0 bg-input border-border justify-between font-normal", !form.assignee_ids[0] && "text-muted-foreground")}
                    >
                      <span className="min-w-0 truncate">
                        {form.assignee_ids[0]
                          ? (employees.find((e) => e.id === form.assignee_ids[0])?.name ?? "Select employee")
                          : "Select employee"}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        {form.assignee_ids[0] && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); setForm({ ...form, assignee_ids: [] }); }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command>
                      <CommandInput placeholder="Search employee…" />
                      <CommandList>
                        <CommandEmpty>No employees found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__ No assignee unassigned"
                            onSelect={() => {
                              setForm({ ...form, assignee_ids: [] });
                              setAssigneePickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", form.assignee_ids.length === 0 ? "opacity-100" : "opacity-0")} />
                            No assignee (Unassigned)
                          </CommandItem>
                          {employees.map((e) => (
                            <CommandItem
                              key={e.id}
                              value={`${e.name} ${e.email}`}
                              onSelect={() => {
                                setForm({ ...form, assignee_ids: [e.id] });
                                setAssigneePickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.assignee_ids[0] === e.id ? "opacity-100" : "opacity-0")} />
                              <span className="flex items-center gap-1.5">
                                <span>{e.name}</span>
                                {myEmployee?.id === e.id && (
                                  <span className="text-xs text-muted-foreground font-normal">(You)</span>
                                )}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Notes, links, sub-steps, context…"
                className="bg-input border-border"
              />
            </div>

            <TaskAttachmentsField files={pendingFiles} onChange={setPendingFiles} />
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border bg-background px-4 py-3 sm:flex sm:justify-end sm:px-6 sm:py-4">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button
              disabled={saving || !canSubmit()}
              className="bg-gradient-primary text-white shadow-glow sm:min-w-28"
              onClick={handleSubmit}
            >
              {saving ? (editingTask ? "Updating…" : "Creating…") : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TaskModalCtx.Provider>
  );
}
