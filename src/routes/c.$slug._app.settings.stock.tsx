import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/app/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  useStockSettings,
  useStockLocations,
  useStockUnits,
  type NamedListRow,
} from "@/hooks/use-stock-settings";
import {
  useInventoryCategories,
  type InventoryCategoryRow,
} from "@/hooks/use-inventory-categories";

export const Route = createFileRoute("/c/$slug/_app/settings/stock")({
  component: StockSettingsPage,
});

function StockSettingsPage() {
  const { isAdmin } = useAuth();
  const { settings, loading, save } = useStockSettings();
  const [gst, setGst] = useState("18");
  const [terms, setTerms] = useState("");
  const [paper, setPaper] = useState<"A4" | "A5">("A4");
  const [template, setTemplate] = useState<"classic" | "modern" | "compact">("classic");
  const [approval, setApproval] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setGst(String(settings.default_gst_percent ?? 18));
    setTerms(settings.default_po_terms ?? "");
    setPaper((settings.paper_size as "A4" | "A5") ?? "A4");
    setTemplate((settings.print_template as "classic" | "modern" | "compact") ?? "classic");
    setApproval(settings.require_approval ?? true);
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    await save({
      default_gst_percent: Number(gst) || 0,
      default_po_terms: terms,
      paper_size: paper,
      print_template: template,
      require_approval: approval,
    });
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 shadow-card space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg">Purchase & Stock Defaults</h2>
          <p className="text-xs text-muted-foreground">Applied to new purchase orders and printed documents.</p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="stock-gst">Default GST %</Label>
                <Input
                  id="stock-gst"
                  type="number"
                  min="0"
                  step="0.01"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-paper">Paper size</Label>
                <Select value={paper} onValueChange={(v) => setPaper(v as "A4" | "A5")} disabled={!isAdmin}>
                  <SelectTrigger id="stock-paper" className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-template">Print format</Label>
                <Select value={template} onValueChange={(v) => setTemplate(v as typeof template)} disabled={!isAdmin}>
                  <SelectTrigger id="stock-template" className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg glass px-4 py-3">
                <div>
                  <Label htmlFor="stock-approval">Require PO approval</Label>
                  <p className="text-xs text-muted-foreground">Orders wait for a manager before ordering.</p>
                </div>
                <Switch id="stock-approval" checked={approval} onCheckedChange={setApproval} disabled={!isAdmin} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stock-terms">Default purchase order terms</Label>
              <Textarea
                id="stock-terms"
                rows={4}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                disabled={!isAdmin}
                className="bg-input border-border"
              />
            </div>

            {isAdmin && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-white shadow-glow">
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <NamedList title="Stores / Locations" subtitle="Where stock is held" hook={useStockLocations} canEdit={isAdmin} />
        <NamedList title="Units" subtitle="Nos, Kg, Box…" hook={useStockUnits} canEdit={isAdmin} />
        <CategoryManagementCard canEdit={isAdmin} />
      </div>
    </div>
  );
}

function CategoryManagementCard({ canEdit }: { canEdit: boolean }) {
  const { categories, loading, createCategory, updateCategory, toggleActive, deleteCategory } =
    useInventoryCategories();
  const confirm = useConfirm();

  // Add category state
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit category dialog state
  const [editingCat, setEditingCat] = useState<InventoryCategoryRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    const created = await createCategory({ name: name.trim(), description: desc.trim() });
    setAdding(false);
    if (created) {
      setName("");
      setDesc("");
    }
  }

  function startEdit(c: InventoryCategoryRow) {
    setEditingCat(c);
    setEditName(c.name);
    setEditDesc(c.description || "");
    setEditActive(c.is_active);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCat || !editName.trim()) return;
    setUpdating(true);
    const ok = await updateCategory(editingCat.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      is_active: editActive,
    });
    setUpdating(false);
    if (ok) setEditingCat(null);
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold">Item categories</h3>
          <p className="text-xs text-muted-foreground">Categorize your inventory items</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {categories.length} {categories.length === 1 ? "category" : "categories"}
        </Badge>
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} className="space-y-2 pt-1">
          <div className="flex gap-2">
            <Input
              placeholder="Add category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input border-border text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={adding || !name.trim()}
              aria-label="Add category"
              className="bg-gradient-primary text-white shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Input
            placeholder="Optional description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="bg-input border-border text-xs h-8"
          />
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories added yet.</p>
      ) : (
        <ul className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {categories.map((c) => (
            <li
              key={c.id}
              className="glass rounded-lg px-3 py-2.5 space-y-1.5 border border-glass-border"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    {c.is_active ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30 px-1.5 py-0 h-4">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border px-1.5 py-0 h-4">
                        Inactive
                      </Badge>
                    )}
                    {typeof c.item_count === "number" && c.item_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        ({c.item_count} {c.item_count === 1 ? "item" : "items"})
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.description}</p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => startEdit(c)}
                      className="h-7 w-7"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${c.name}`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete category "${c.name}"?`,
                          description:
                            typeof c.item_count === "number" && c.item_count > 0
                              ? `This category is assigned to ${c.item_count} item(s). Deletion will be blocked.`
                              : "This category will be permanently removed.",
                          confirmText: "Delete",
                          destructive: true,
                        });
                        if (ok) await deleteCategory(c.id);
                      }}
                      className="h-7 w-7 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCat} onOpenChange={(open) => !open && setEditingCat(null)}>
        <DialogContent className="glass-strong max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Edit Category</DialogTitle>
            <DialogDescription>Update category details and status.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cat-name">Category name</Label>
              <Input
                id="edit-cat-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-input border-border"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cat-desc">Description</Label>
              <Input
                id="edit-cat-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-input border-border"
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg glass p-3 border border-glass-border">
              <div>
                <Label htmlFor="edit-cat-active" className="text-sm font-medium">Active status</Label>
                <p className="text-xs text-muted-foreground">Inactive categories are hidden in New Item dropdowns.</p>
              </div>
              <Switch
                id="edit-cat-active"
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingCat(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updating || !editName.trim()}
                className="bg-gradient-primary text-white shadow-glow"
              >
                {updating ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NamedList({
  title,
  subtitle,
  hook,
  canEdit,
}: {
  title: string;
  subtitle: string;
  hook: () => {
    rows: NamedListRow[];
    loading: boolean;
    add: (name: string) => Promise<unknown>;
    update: (id: string, patch: Partial<NamedListRow>) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  };
  canEdit: boolean;
}) {
  const { rows, loading, add, update, remove } = hook();
  const confirm = useConfirm();
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <div className="glass rounded-2xl p-5 shadow-card space-y-3">
      <div>
        <h3 className="font-display font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!value.trim()) return;
            await add(value.trim());
            setValue("");
          }}
        >
          <Input
            placeholder={`Add ${title.toLowerCase()}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-input border-border"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={`Add to ${title}`}
            className="bg-gradient-primary text-white shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 glass rounded-lg px-3 py-2">
              {editingId === r.id ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 bg-input border-border"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (editValue.trim()) await update(r.id, { name: editValue.trim() });
                      setEditingId(null);
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate">{r.name}</span>
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${r.name}`}
                        onClick={() => {
                          setEditingId(r.id);
                          setEditValue(r.name);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${r.name}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Delete ${r.name}?`,
                            confirmText: "Delete",
                            destructive: true,
                          });
                          if (ok) await remove(r.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
