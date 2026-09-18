import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type { StockItemInput, StockItemRow } from "@/hooks/use-stock-items";
import { useStockUnits, DEFAULT_UNITS } from "@/hooks/use-stock-settings";
import { useInventoryCategories } from "@/hooks/use-inventory-categories";

const empty: StockItemInput = {
  name: "",
  code: "",
  category_id: null,
  category: "",
  unit: "Nos",
  purchase_rate: 0,
  selling_rate: 0,
  min_stock: 0,
  notes: "",
  is_active: true,
};

export function StockItemFormDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: StockItemRow | null;
  onSubmit: (v: StockItemInput) => Promise<unknown>;
}) {
  const { categories, activeCategories, createCategory } = useInventoryCategories();
  const { rows: units } = useStockUnits();
  const unitNames = units.length ? units.map((u) => u.name) : DEFAULT_UNITS;

  const [v, setV] = useState<StockItemInput>(empty);
  const [saving, setSaving] = useState(false);

  // Quick add category dialog state
  const [openAddCat, setOpenAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      // Resolve category_id if item only had category text
      const matchedCat = item.category_id
        ? categories.find((c) => c.id === item.category_id)
        : categories.find((c) => c.name.toLowerCase() === (item.category || "").toLowerCase());

      setV({
        name: item.name,
        code: item.code,
        category_id: matchedCat?.id ?? item.category_id ?? null,
        category: matchedCat?.name ?? item.category ?? "",
        unit: item.unit,
        purchase_rate: item.purchase_rate,
        selling_rate: item.selling_rate,
        min_stock: item.min_stock,
        notes: item.notes,
        is_active: item.is_active,
      });
    } else {
      setV(empty);
    }
  }, [open, item, categories]);

  const set = (patch: Partial<StockItemInput>) => setV((p) => ({ ...p, ...patch }));

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    setCreatingCat(true);
    const created = await createCategory({
      name: trimmed,
      description: newCatDesc.trim(),
    });
    setCreatingCat(false);

    if (created) {
      set({ category_id: created.id, category: created.name });
      setNewCatName("");
      setNewCatDesc("");
      setOpenAddCat(false);
    }
  }

  async function save() {
    if (!v.name.trim()) return;
    setSaving(true);
    const ok = await onSubmit({
      ...v,
      name: v.name.trim(),
      category_id: v.category_id || null,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  const selectedSelectValue = v.category_id
    ? v.category_id
    : v.category
    ? `legacy:${v.category}`
    : "none";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{item ? "Edit item" : "New item"}</DialogTitle>
            <DialogDescription>Items you purchase and hold in stock.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 py-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Item name</Label>
              <Input
                value={v.name}
                onChange={(e) => set({ name: e.target.value })}
                className="bg-input border-border"
                placeholder="e.g. Copper Wire"
              />
            </div>
            <div className="grid gap-2">
              <Label>Item code</Label>
              <Input
                value={v.code}
                onChange={(e) => set({ code: e.target.value })}
                className="bg-input border-border"
                placeholder="e.g. CW-001"
              />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={selectedSelectValue}
                onValueChange={(val) => {
                  if (val === "none") {
                    set({ category_id: null, category: "" });
                    return;
                  }
                  if (val.startsWith("legacy:")) {
                    set({ category_id: null, category: val.replace("legacy:", "") });
                    return;
                  }
                  const matched = categories.find((c) => c.id === val);
                  set({ category_id: val, category: matched?.name ?? "" });
                }}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">No category</SelectItem>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {/* Keep legacy unlinked category visible if item had one */}
                  {v.category &&
                    !v.category_id &&
                    !activeCategories.some((c) => c.name === v.category) && (
                      <SelectItem value={`legacy:${v.category}`}>{v.category}</SelectItem>
                    )}
                  <div className="p-1 border-t border-glass-border mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenAddCat(true);
                      }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-primary hover:bg-white/10 rounded-md transition font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add category
                    </button>
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Select value={v.unit} onValueChange={(val) => set({ unit: val })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitNames.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Purchase rate (₹)</Label>
              <Input
                type="number"
                value={v.purchase_rate}
                onChange={(e) => set({ purchase_rate: Number(e.target.value) })}
                className="bg-input border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label>Selling rate (₹)</Label>
              <Input
                type="number"
                value={v.selling_rate}
                onChange={(e) => set({ selling_rate: Number(e.target.value) })}
                className="bg-input border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label>Minimum stock level</Label>
              <Input
                type="number"
                value={v.min_stock}
                onChange={(e) => set({ min_stock: Number(e.target.value) })}
                className="bg-input border-border"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={v.notes}
                onChange={(e) => set({ notes: e.target.value })}
                rows={2}
                className="bg-input border-border"
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                checked={v.is_active}
                onCheckedChange={(c) => set({ is_active: c })}
                id="item-active"
              />
              <Label htmlFor="item-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || !v.name.trim()}
              className="bg-gradient-primary text-white shadow-glow"
            >
              {saving ? "Saving…" : item ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Add Category Dialog */}
      <Dialog open={openAddCat} onOpenChange={setOpenAddCat}>
        <DialogContent className="glass-strong max-w-sm z-[100]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add Category</DialogTitle>
            <DialogDescription>Create a new category for stock items.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dialog-cat-name">
                Category name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dialog-cat-name"
                placeholder="e.g. Raw Materials"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="bg-input border-border"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dialog-cat-desc">Description (optional)</Label>
              <Input
                id="dialog-cat-desc"
                placeholder="e.g. Basic production inputs"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpenAddCat(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingCat || !newCatName.trim()}
                className="bg-gradient-primary text-white shadow-glow"
              >
                {creatingCat ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
