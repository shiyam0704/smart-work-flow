import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDepartments, type DepartmentRow } from "@/hooks/use-departments";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/c/$slug/_app/settings/departments")({
  component: DeptSettings,
});

const COLOR_PRESETS = [
  { label: "Cyan", value: "var(--neon-cyan)" },
  { label: "Pink", value: "var(--neon-pink)" },
  { label: "Green", value: "var(--neon-green)" },
  { label: "Purple", value: "var(--neon-purple)" },
  { label: "Yellow", value: "var(--neon-yellow)" },
  { label: "Orange", value: "var(--neon-orange)" },
];

function DeptSettings() {
  const { departments, loading, addDepartment, updateDepartment, deleteDepartment, move } = useDepartments();
  const { isAdmin } = useAuth();

  return (
    <div className="glass rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-lg">Departments</h2>
          <p className="text-xs text-muted-foreground">Used across clients and tasks. Managed by admins.</p>
        </div>
        {isAdmin && (
          <DepartmentDialog
            trigger={
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> New Department
              </Button>
            }
            onSave={async (values) => { await addDepartment(values); }}
          />
        )}
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {departments.map((d, i) => (
            <div key={d.id} className="flex items-center gap-3 p-3 glass rounded-lg">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                style={{ background: `color-mix(in oklch, ${d.color} 20%, transparent)`, color: d.color }}
              >
                {d.code}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground">Code: {d.code}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-md ${d.is_active ? "bg-neon-green/10 text-neon-green" : "bg-muted text-muted-foreground"}`}>
                {d.is_active ? "Active" : "Inactive"}
              </span>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(d.id, "up")} aria-label={`Move ${d.name} up`}>
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={i === departments.length - 1} onClick={() => move(d.id, "down")} aria-label={`Move ${d.name} down`}>
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <DepartmentDialog
                    department={d}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${d.name}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    }
                    onSave={async (values) => { await updateDepartment(d.id, values); }}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={`Delete ${d.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete department?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{d.name}". Clients, employees, or tasks linked to it may be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDepartment(d.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
          {departments.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">No departments yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

function DepartmentDialog({
  trigger,
  department,
  onSave,
}: {
  trigger: React.ReactNode;
  department?: DepartmentRow;
  onSave: (values: { name: string; code: string; color: string; is_active: boolean }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(department?.name ?? "");
  const [code, setCode] = useState(department?.code ?? "");
  const [color, setColor] = useState(department?.color ?? COLOR_PRESETS[0].value);
  const [isActive, setIsActive] = useState(department?.is_active ?? true);

  const reset = () => {
    setName(department?.name ?? "");
    setCode(department?.code ?? "");
    setColor(department?.color ?? COLOR_PRESETS[0].value);
    setIsActive(department?.is_active ?? true);
  };

  const submit = async () => {
    if (!name.trim() || !code.trim()) return;
    await onSave({ name: name.trim(), code: code.trim().toUpperCase(), color, is_active: isActive });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? "Edit Department" : "New Department"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing" />
          </div>
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MKT" maxLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-lg border-2 transition ${color === c.value ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>{department ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
