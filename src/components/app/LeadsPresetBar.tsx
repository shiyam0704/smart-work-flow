import { useState } from "react";
import { Bookmark, Save, Settings2, Star, StarOff, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { LeadPreset, LeadPresetConfig } from "@/hooks/use-lead-presets";
import { toast } from "sonner";

interface Props {
  presets: LeadPreset[];
  currentConfig: LeadPresetConfig;
  onApply: (config: LeadPresetConfig) => void;
  onSave: (name: string, config: LeadPresetConfig) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string | null) => void;
}

export function LeadsPresetBar({ presets, currentConfig, onApply, onSave, onRename, onDelete, onSetDefault }: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Bookmark className="w-4 h-4" /> Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          {presets.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No presets yet</div>
          )}
          {presets.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => onApply(p.config)}>
              {p.is_default && <Star className="w-3 h-3 mr-2 text-amber-400" />}
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setName(""); setSaveOpen(true); }}>
            <Save className="w-3.5 h-3.5 mr-2" /> Save current…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setManageOpen(true)} disabled={presets.length === 0}>
            <Settings2 className="w-3.5 h-3.5 mr-2" /> Manage presets
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Save current view</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Preset name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                onSave(name.trim(), currentConfig);
                toast.success("Preset saved");
                setSaveOpen(false);
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Manage presets</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {presets.map((p) => (
              <PresetRow key={p.id} preset={p} onRename={onRename} onDelete={onDelete} onSetDefault={onSetDefault} />
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setManageOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PresetRow({
  preset, onRename, onDelete, onSetDefault,
}: {
  preset: LeadPreset; onRename: (id: string, n: string) => void;
  onDelete: (id: string) => void; onSetDefault: (id: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(preset.name);
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-glass-border">
      {editing ? (
        <>
          <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-8 flex-1" />
          <Button size="sm" className="h-8" onClick={() => { onRename(preset.id, val); setEditing(false); }}>Save</Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm truncate flex items-center gap-1.5">
            {preset.is_default && <Star className="w-3.5 h-3.5 text-amber-400" />}
            {preset.name}
          </span>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onSetDefault(preset.is_default ? null : preset.id)}
            title={preset.is_default ? "Remove default" : "Set as default"}
          >
            {preset.is_default ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
          </button>
          <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)} title="Rename">
            <Pencil className="w-4 h-4" />
          </button>
          <button className="text-destructive hover:text-destructive/80" onClick={() => onDelete(preset.id)} title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}