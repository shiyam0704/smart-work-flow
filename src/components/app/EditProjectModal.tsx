import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartments } from "@/hooks/use-departments";
import { useClientsData } from "@/hooks/use-clients-data";
import { useProjectFields } from "@/hooks/use-project-fields";
import { useProjects, type ProjectRow, type ProjectInput } from "@/hooks/use-projects";
import { useProjectTemplates, applyProjectTemplate } from "@/hooks/use-project-templates";

const empty = (clientId?: string): ProjectInput => ({
  client_id: clientId ?? "",
  name: "",
  start_date: null,
  deadline_date: null,
  status: "active",
  priority: "medium",
  custom_fields: {},
  quoted_price: null,
  final_price: null,
  work_details: "",
  department_ids: [],
});


export function EditProjectModal({
  open,
  onOpenChange,
  project,
  clientId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project?: ProjectRow;
  clientId?: string;
  onSaved?: (id: string) => void;
}) {
  const { departments } = useDepartments();
  const { clients } = useClientsData();
  const { fields } = useProjectFields();
  const { addProject, updateProject } = useProjects();
  const { templates } = useProjectTemplates();

  const [form, setForm] = useState<ProjectInput>(empty(clientId));
  const [templateId, setTemplateId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const selectedTemplate =
    templateId && templateId !== "__blank" ? templates.find((t) => t.id === templateId) : undefined;

  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    if (project) {
      setForm({
        client_id: project.client_id,
        name: project.name,
        start_date: project.start_date,
        deadline_date: project.deadline_date,
        status: project.status,
        priority: project.priority ?? "medium",
        custom_fields: project.custom_fields ?? {},
        quoted_price: project.quoted_price,
        final_price: project.final_price,
        work_details: project.work_details ?? "",
        department_ids: project.department_ids,
      });

    } else {
      setForm(empty(clientId));
    }
  }, [open, project, clientId]);

  const setCF = (label: string, value: string | number | boolean) =>
    setForm((f) => ({ ...f, custom_fields: { ...f.custom_fields, [label]: value } }));

  const toggleDept = (id: string) =>
    setForm((f) => ({
      ...f,
      department_ids: f.department_ids.includes(id)
        ? f.department_ids.filter((d) => d !== id)
        : [...f.department_ids, id],
    }));

  const onTemplateChange = (v: string) => {
    setTemplateId(v);
    if (v && v !== "__blank") {
      const t = templates.find((x) => x.id === v);
      if (t) {
        setForm((f) => ({
          ...f,
          // Merge template departments with any already selected so editing doesn't drop them
          department_ids: Array.from(new Set([...f.department_ids, ...t.department_ids])),
        }));
      }
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.client_id || !form.work_details.trim()) return;
    if (form.final_price == null || !(Number(form.final_price) > 0)) return;
    const willApplyTemplate = templateId && templateId !== "__blank";
    if (project && willApplyTemplate) {
      const ok = window.confirm(
        "Applying this template will remove all existing tasks in this project and replace them with the template's tasks. Continue?",
      );
      if (!ok) return;
    }
    setSaving(true);
    const res = project ? await updateProject(project.id, form) : await addProject(form);
    if (res && willApplyTemplate) {
      const projectIdForTemplate = project ? project.id : (res as string);
      await applyProjectTemplate(projectIdForTemplate, templateId, form.client_id, {
        replaceExisting: !!project,
      });
    }
    setSaving(false);
    if (res) {
      onSaved?.(typeof res === "string" ? res : project!.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>Projects belong to a client and group tasks across departments.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Start from template</Label>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No project templates yet. Create one in Settings → Project templates to scaffold tasks automatically.
              </p>
            ) : (
              <>
                <Select value={templateId || "__blank"} onValueChange={onTemplateChange}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder={project ? "Don't add template tasks" : "Blank project"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__blank">{project ? "Don't add template tasks" : "Blank project"}</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.tasks.length} task{t.tasks.length === 1 ? "" : "s"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.tasks.length} task{selectedTemplate.tasks.length === 1 ? "" : "s"} will be created.
                    Task due dates are calculated back from the project deadline.
                  </p>
                )}
                {selectedTemplate && !form.deadline_date && (
                  <p className="text-xs text-amber-500">
                    Set a deadline date to give the template tasks due dates.
                  </p>
                )}
                {project && selectedTemplate && (
                  <p className="text-xs text-destructive">
                    Existing tasks in this project will be removed and replaced with this template's tasks.
                  </p>
                )}
              </>
            )}
          </div>


          <div className="grid gap-2">
            <Label>Project name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Summer Campaign 2026"
              className="bg-input border-border"
            />
          </div>

          {(!clientId || project) && (
            <div className="grid gap-2">
              <Label>Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}


          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label>Starting date</Label>
              <Input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm({ ...form, start_date: e.target.value || null })}
                className="bg-input border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label>Deadline date</Label>
              <Input
                type="date"
                value={form.deadline_date ?? ""}
                onChange={(e) => setForm({ ...form, deadline_date: e.target.value || null })}
                className="bg-input border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: ProjectInput["status"]) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not yet started</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v: ProjectInput["priority"]) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {project && (
                <p className="text-[11px] text-muted-foreground">
                  Changing this updates all tasks in this project to match.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Quoted price (₹)</Label>
              <Input
                type="number"
                value={form.quoted_price ?? ""}
                onChange={(e) =>
                  setForm({ ...form, quoted_price: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="bg-input border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label>Final price (₹) *</Label>
              <Input
                type="number"
                value={form.final_price ?? ""}
                onChange={(e) =>
                  setForm({ ...form, final_price: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="bg-input border-border"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Work details *</Label>
            <Textarea
              value={form.work_details}
              onChange={(e) => setForm({ ...form, work_details: e.target.value })}
              placeholder="Describe the scope of work for this project"
              className="bg-input border-border min-h-[80px]"
            />
          </div>

          <div className="grid gap-2">
            <Label>Subscribed departments</Label>
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => {
                const active = form.department_ids.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDept(d.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      active ? "text-white border-transparent shadow-glow" : "text-muted-foreground border-glass-border hover:text-foreground"
                    }`}
                    style={active ? { background: d.color } : undefined}
                  >
                    {d.name}
                  </button>
                );
              })}
              {departments.length === 0 && (
                <span className="text-xs text-muted-foreground">No departments defined yet.</span>
              )}
            </div>
          </div>

          {fields.length > 0 && (
            <div className="glass rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom fields</div>
              <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => (
                  <div key={f.id} className="grid gap-1.5">
                    <Label className="text-xs">
                      {f.label}
                      {f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {f.field_type === "select" ? (
                      <Select
                        value={String(form.custom_fields[f.label] ?? "")}
                        onValueChange={(v) => setCF(f.label, v)}
                      >
                        <SelectTrigger className="bg-input border-border h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : f.field_type === "checkbox" ? (
                      <Checkbox
                        checked={Boolean(form.custom_fields[f.label])}
                        onCheckedChange={(v) => setCF(f.label, Boolean(v))}
                      />
                    ) : (
                      <Input
                        type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                        value={String(form.custom_fields[f.label] ?? "")}
                        onChange={(e) =>
                          setCF(f.label, f.field_type === "number" ? Number(e.target.value) : e.target.value)
                        }
                        className="bg-input border-border h-9"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={
              saving ||
              !form.name.trim() ||
              !form.client_id ||
              !form.work_details.trim() ||
              form.final_price == null ||
              !(Number(form.final_price) > 0)
            }
            className="bg-gradient-primary text-white shadow-glow"
            onClick={handleSave}
          >
            {saving ? "Saving…" : project ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
