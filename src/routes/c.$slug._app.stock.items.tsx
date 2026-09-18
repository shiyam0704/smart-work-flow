import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/app/confirm-dialog";
import { StockItemFormDialog } from "@/components/stock/StockItemFormDialog";
import { useStockItems, type StockItemRow } from "@/hooks/use-stock-items";
import { useStockCategories } from "@/hooks/use-stock-settings";
import { formatINR } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { useCanManage } from "@/hooks/use-permissions";

export const Route = createFileRoute("/c/$slug/_app/stock/items")({
  component: StockItemsPage,
});

const ALL = "all";

function StockItemsPage() {
  const { items, loading, addItem, updateItem, deleteItem } = useStockItems();
  const canManage = useCanManage("stock");
  const { rows: categories } = useStockCategories();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockItemRow | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedCat = categories.find((c) => c.id === category);
    return items.filter((i) => {
      if (category !== ALL) {
        const matchesId = i.category_id === category;
        const matchesName = selectedCat && i.category.toLowerCase() === selectedCat.name.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }
      if (!q) return true;
      return [i.name, i.code, i.category, i.unit].join(" ").toLowerCase().includes(q);
    });
  }, [items, query, category, categories]);

  async function handleDelete(i: StockItemRow) {
    const ok = await confirm({
      title: "Delete item?",
      description: `"${i.name}" will be deleted. This action cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteItem(i.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative sm:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 bg-input border-border" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv(
                "stock-items",
                rows.map((i) => ({
                  Name: i.name,
                  Code: i.code,
                  Category: i.category,
                  Unit: i.unit,
                  "Purchase rate": i.purchase_rate,
                  "Min stock": i.min_stock,
                  Status: i.is_active ? "Active" : "Inactive",
                })),
              )
            }
          >
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-white shadow-glow" disabled={!canManage}>
            <Plus className="w-4 h-4" /> New item
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No items yet.</div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b border-glass-border">
            <div className="col-span-4">Item</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Unit</div>
            <div className="col-span-2 text-right">Rate</div>
            <div className="col-span-1 text-right">Min</div>
            <div className="col-span-1" />
          </div>
          {rows.map((i) => (
            <div key={i.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3 border-b border-glass-border last:border-0 items-center">
              <div className="md:col-span-4 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{i.name}</p>
                  {!i.is_active && (
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{i.code || "No code"}</p>
              </div>
              <div className="md:col-span-2 text-sm truncate">{i.category || "—"}</div>
              <div className="md:col-span-2 text-sm">{i.unit}</div>
              <div className="md:col-span-2 md:text-right text-sm">{formatINR(i.purchase_rate)}</div>
              <div className="md:col-span-1 md:text-right text-sm">{i.min_stock}</div>
              <div className="md:col-span-1 flex md:justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label="Edit item" disabled={!canManage} onClick={() => { setEditing(i); setOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete item" disabled={!canManage} onClick={() => handleDelete(i)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <StockItemFormDialog
        open={open}
        onOpenChange={setOpen}
        item={editing}
        onSubmit={async (v) => (editing ? await updateItem(editing.id, v) : await addItem(v))}
      />
    </div>
  );
}
