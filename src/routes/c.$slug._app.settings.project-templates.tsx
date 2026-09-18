import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDepartments } from "@/hooks/use-departments";
import { useEmployees } from "@/hooks/use-employees";
import {
  useProjectTemplates,
  type TemplateRow,
  type TemplateTaskInput,
} from "@/hooks/use-project-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useConfirm } from "@/components/app/confirm-dialog";

export const Route = createFileRoute("/c/$slug/_app/settings/project-templates")({
  component: ProjectTemplatesPage,
});

type EditorTask = TemplateTaskInput & { _key: string };

function ProjectTemplatesPage() {
  const { isAdmin } = useAuth();
  const { templates, loading, saveTemplate, deleteTemplate } = useProjectTemplates();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")} className="bg-gradient-primary text-white shadow-glow">
            <Plus className="w-4 h-4" /> New template
          </Button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <div key={t.id} className="glass rounded-2xl p-4 shadow-card">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {t.description || "No description"}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  {t.tasks.length} tasks · {t.department_ids.length} departments
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(t)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Delete "${t.name}"?`,
                          description: "This template will no longer appear in the new project form.",
                          requireType: "DELETE",
                        })
                      )
                        deleteTemplate(t.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="text-sm text-muted-foreground col-span-full p-6 text-center">
            No templates yet. Create one to scaffold projects faster.
          </div>
        )}
      </div>

      {editing && (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input, tasks) => {
            const ok = await saveTemplate(input, tasks);
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSave,
}: {
  template: TemplateRow | null;
  onClose: () => void;
  onSave: (
    input: { id?: string; name: string; description: string; department_ids: string[] },
    tasks: TemplateTaskInput[],
  ) => void | Promise<void>;
}) {
  const { departments } = useDepartments();
  const { employees } = useEmployees();

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [deptIds, setDeptIds] = useState<string[]>(template?.department_ids ?? []);
  const [tasks, setTasks] = useState<EditorTask[]>(
    (template?.tasks ?? []).map((t, i) => ({
      _key: `${t.id}-${i}`,
      title: t.title,
      department_id: t.department_id,
      due_offset_days: t.due_offset_days ?? 0,
      assignee_ids: t.assignee_ids,
    })),
  );
  const [saving, setSaving] = useState(false);

  const toggleDept = (id: string) =>
    setDeptIds((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const addTask = () =>
    setTasks((t) => [
      ...t,
      {
        _key: `new-${Date.now()}-${Math.random()}`,
        title: "",
        department_id: deptIds[0] ?? null,
        due_offset_days: 0,
        assignee_ids: [],
      },
    ]);

  const patchTask = (key: string, patch: Partial<EditorTask>) =>
    setTasks((t) => t.map((x) => (x._key === key ? { ...x, ...patch } : x)));

  const removeTask = (key: string) => setTasks((t) => t.filter((x) => x._key !== key));

  const handleSave = async () => {
    if (!name.trim()) return;
    const cleanTasks = tasks
      .filter((t) => t.title.trim())
      .map(({ _key, ...rest }) => rest);
    setSaving(true);
    await onSave(
      {
        id: template?.id,
        name: name.trim(),
        description: description.trim(),
        department_ids: deptIds,
      },
      cleanTasks,
    );
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {template ? "Edit template" : "New project template"}
          </DialogTitle>
          <DialogDescription>
            Templates pre-fill departments and create tasks (with default assignees) when a new project starts from this template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Web Project"
              className="bg-input border-border"
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When to use this template"
              className="bg-input border-border min-h-[60px]"
            />
          </div>

          <div className="grid gap-2">
            <Label>Departments</Label>
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => {
                const active = deptIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDept(d.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      active
                        ? "text-white border-transparent shadow-glow"
                        : "text-muted-foreground border-glass-border hover:text-foreground"
                    }`}
                    style={active ? { background: d.color } : undefined}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tasks</Label>
              <Button size="sm" variant="ghost" onClick={addTask}>
                <Plus className="w-3.5 h-3.5" /> Add task
              </Button>
            </div>
            {tasks.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center glass rounded-lg">
                No tasks yet. Click "Add task" to define the first one.
              </div>
            )}
            {tasks.map((t) => {
              const deptOptions = departments.filter((d) => deptIds.includes(d.id));
              return (
                <div key={t._key} className="glass rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={t.title}
                      onChange={(e) => patchTask(t._key, { title: e.target.value })}
                      placeholder="Task title"
                      className="bg-input border-border flex-1"
                    />
                    <button
                      onClick={() => removeTask(t._key)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={t.department_id ?? ""}
                      onValueChange={(v) =>
                        patchTask(t._key, { department_id: v })
                      }
                    >
                      <SelectTrigger className="bg-input border-border h-9">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {deptOptions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(() => {
                      const presets = [0, 1, 2, 3, 7];
                      const isPreset = presets.includes(t.due_offset_days);
                      const selectValue = isPreset ? String(t.due_offset_days) : "custom";
                      return (
                        <div className="flex gap-2">
                          <Select
                            value={selectValue}
                            onValueChange={(v) => {
                              if (v === "custom") {
                                if (isPreset) patchTask(t._key, { due_offset_days: 1 });
                              } else {
                                patchTask(t._key, { due_offset_days: Number(v) });
                              }
                            }}
                          >
                            <SelectTrigger className="bg-input border-border h-9 flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">On project due date</SelectItem>
                              <SelectItem value="1">1 day before</SelectItem>
                              <SelectItem value="2">2 days before</SelectItem>
                              <SelectItem value="3">3 days before</SelectItem>
                              <SelectItem value="7">7 days before</SelectItem>
                              <SelectItem value="custom">Custom…</SelectItem>
                            </SelectContent>
                          </Select>
                          {!isPreset && (
                            <Input
                              type="number"
                              min={0}
                              value={t.due_offset_days}
                              onChange={(e) =>
                                patchTask(t._key, {
                                  due_offset_days: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="bg-input border-border h-9 w-20"
                              aria-label="Days before project due date"
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <AssigneePicker
                    employees={employees}
                    selected={t.assignee_ids}
                    onChange={(ids) => patchTask(t._key, { assignee_ids: ids })}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-gradient-primary text-white shadow-glow"
          >
            {saving ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssigneePicker({
  employees,
  selected,
  onChange,
}: {
  employees: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((id) => {
          const e = employees.find((x) => x.id === id);
          if (!e) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-xs"
            >
              {e.name}
              <button onClick={() => toggle(id)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs glass border-glass-border">
              <Plus className="w-3 h-3" /> Default assignee
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-64" align="start">
            <Command>
              <CommandInput placeholder="Search employee…" />
              <CommandList>
                <CommandEmpty>No employees</CommandEmpty>
                <CommandGroup>
                  {employees.map((e) => (
                    <CommandItem
                      key={e.id}
                      value={e.name}
                      onSelect={() => toggle(e.id)}
                    >
                      <span className={selected.includes(e.id) ? "font-semibold" : ""}>{e.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
