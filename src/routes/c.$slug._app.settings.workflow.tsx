import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useWorkflowStates, type WorkflowStateRow } from "@/hooks/use-workflow-states";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus } from "lucide-react";
import { useConfirm } from "@/components/app/confirm-dialog";

export const Route = createFileRoute("/c/$slug/_app/settings/workflow")({
  component: WorkflowSettings,
});

const PRESET_COLORS = [
  "var(--muted-foreground)",
  "var(--neon-cyan)",
  "var(--neon-purple)",
  "var(--neon-pink)",
  "var(--neon-amber)",
  "var(--neon-green)",
];

function WorkflowSettings() {
  const { isAdmin } = useAuth();
  const { states, loading, addState, updateState, deleteState, move } = useWorkflowStates();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<WorkflowStateRow | "new" | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const openNew = () => {
    setEditing("new");
    setName("");
    setColor(PRESET_COLORS[0]);
  };
  const openEdit = (s: WorkflowStateRow) => {
    setEditing(s);
    setName(s.name);
    setColor(s.color);
  };
  const save = async () => {
    if (!name.trim()) return;
    if (editing === "new") await addState({ name: name.trim(), color });
    else if (editing) await updateState(editing.id, { name: name.trim(), color });
    setEditing(null);
  };

  return (
    <div className="glass rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-lg">Workflow States</h2>
          <p className="text-xs text-muted-foreground">Default flow applied to all departments.</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="bg-gradient-primary text-white shadow-glow">
            <Plus className="w-4 h-4" /> Add state
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {states.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 p-3 glass rounded-lg">
              <div className="flex flex-col">
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={!isAdmin || i === 0}
                  onClick={() => move(s.id, -1)}
                  aria-label="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={!isAdmin || i === states.length - 1}
                  onClick={() => move(s.id, 1)}
                  aria-label="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              <span className="font-medium flex-1">{s.name}</span>
              <span className="text-xs text-muted-foreground">#{s.sort_order}</span>
              {isAdmin && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={`Edit stage ${s.name}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete stage ${s.name}`}
                    onClick={async () => {
                      if (await confirm({ title: `Delete "${s.name}"?`, description: "Tasks using this status will lose it.", requireType: "DELETE" })) {
                        deleteState(s.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {states.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">No states yet.</div>
          )}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing === "new" ? "Add workflow state" : "Edit workflow state"}
            </DialogTitle>
            <DialogDescription>States define how tasks progress through your workflow.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. In Review"
                className="bg-input border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={`Pick ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!name.trim()} className="bg-gradient-primary text-white shadow-glow">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
