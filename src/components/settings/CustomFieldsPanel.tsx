import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { type FieldType } from "@/lib/field-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useConfirm } from "@/components/app/confirm-dialog";

const FIELD_TYPES: FieldType[] = ["text", "number", "date", "select", "checkbox", "url"];

export interface FieldDefRow {
  id: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  required: boolean;
  sort_order: number;
}

export interface FieldsHookApi {
  fields: FieldDefRow[];
  loading: boolean;
  addField: (input: { label: string; field_type: FieldType; required: boolean; options: string[] | null }) => Promise<unknown>;
  updateField: (id: string, patch: Partial<Pick<FieldDefRow, "label" | "field_type" | "required" | "options">>) => Promise<unknown>;
  deleteField: (id: string) => Promise<unknown>;
  moveField: (id: string, dir: -1 | 1) => Promise<unknown>;
}

interface Props {
  api: FieldsHookApi;
  /** Noun used in labels e.g. "employee" → "Add employee field" */
  noun: string;
  /** Noun for the empty and description sentences e.g. "employees" */
  nounPlural: string;
  /** Placeholder shown in the label input */
  labelPlaceholder?: string;
}

export function CustomFieldsPanel({ api, noun, nounPlural, labelPlaceholder }: Props) {
  const { isAdmin } = useAuth();
  const { fields, loading, addField, updateField, deleteField, moveField } = api;
  const confirm = useConfirm();

  const [editing, setEditing] = useState<FieldDefRow | { _new: true } | null>(null);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const openNew = () => {
    setEditing({ _new: true });
    setLabel(""); setFieldType("text"); setRequired(false); setOptionsText("");
  };
  const openEdit = (f: FieldDefRow) => {
    setEditing(f);
    setLabel(f.label); setFieldType(f.field_type); setRequired(f.required);
    setOptionsText((f.options ?? []).join("\n"));
  };
  const save = async () => {
    if (!label.trim()) return;
    const options = fieldType === "select"
      ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
      : null;
    if (editing && "_new" in editing) {
      await addField({ label: label.trim(), field_type: fieldType, required, options });
    } else if (editing) {
      await updateField(editing.id, { label: label.trim(), field_type: fieldType, required, options });
    }
    setEditing(null);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const sorted = fields.slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openNew} className="bg-gradient-primary text-white shadow-glow">
            <Plus className="w-4 h-4" /> Add {noun} field
          </Button>
        </div>
      )}

      <div className="glass rounded-2xl p-5 shadow-card space-y-2">
        {sorted.length === 0 && (
          <div className="text-xs text-muted-foreground p-3">No custom {noun} fields yet.</div>
        )}
        {sorted.map((f, i) => (
          <div key={f.id} className="flex items-center gap-3 p-3 glass rounded-lg text-sm">
            {isAdmin && (
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => moveField(f.id, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button disabled={i === sorted.length - 1} onClick={() => moveField(f.id, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
            <span className="font-medium flex-1">{f.label}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-muted-foreground">{f.field_type}</span>
            {f.required && <span className="text-xs px-2 py-0.5 rounded bg-destructive/15 text-destructive">required</span>}
            {isAdmin && (
              <>
                <button onClick={() => openEdit(f)} className="text-muted-foreground hover:text-foreground" aria-label="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => { if (await confirm({ title: `Delete field "${f.label}"?`, requireType: "DELETE" })) deleteField(f.id); }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing && "_new" in editing ? `Add ${noun} field` : `Edit ${noun} field`}
            </DialogTitle>
            <DialogDescription>Custom fields appear when adding or editing {nounPlural}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={labelPlaceholder} className="bg-input border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={fieldType} onValueChange={(v: FieldType) => setFieldType(v)}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between gap-2">
                <Label>Required</Label>
                <Switch checked={required} onCheckedChange={setRequired} />
              </div>
            </div>
            {fieldType === "select" && (
              <div className="grid gap-2">
                <Label>Options (one per line)</Label>
                <Textarea
                  rows={4}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={"Option A\nOption B"}
                  className="bg-input border-border"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!label.trim()} className="bg-gradient-primary text-white shadow-glow">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}