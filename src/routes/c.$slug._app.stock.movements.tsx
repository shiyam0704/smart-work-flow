import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/app/confirm-dialog";
import { StockMovementDialog } from "@/components/stock/StockMovementDialog";
import { useStockMovements, MOVEMENT_META, type MovementType, type StockMovementRow } from "@/hooks/use-stock-movements";
import { useStockItems } from "@/hooks/use-stock-items";
import { useStockLocations } from "@/hooks/use-stock-settings";
import { useProjects } from "@/hooks/use-projects";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { useCanManage } from "@/hooks/use-permissions";

export const Route = createFileRoute("/c/$slug/_app/stock/movements")({
  component: StockMovementsPage,
});

const ALL = "all";

function StockMovementsPage() {
  const { movements, loading, addMovement, deleteMovement } = useStockMovements();
  const canManage = useCanManage("stock");
  const { items } = useStockItems();
  const { rows: locations } = useStockLocations();
  const { projects } = useProjects();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>(ALL);
  const [open, setOpen] = useState(false);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "Item";
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const projName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (type !== ALL && m.movement_type !== type) return false;
      if (!q) return true;
      return [itemName(m.item_id), m.note, m.reference_type, projName(m.project_id)].join(" ").toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, query, type, items, projects]);

  async function handleDelete(m: StockMovementRow) {
    const ok = await confirm({
      title: "Delete movement?",
      description: "Stock balance will be recalculated without this entry.",
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteMovement(m.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative sm:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search movements…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 bg-input border-border" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-40 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {(Object.keys(MOVEMENT_META) as MovementType[]).map((m) => (
              <SelectItem key={m} value={m}>{MOVEMENT_META[m].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv(
                "stock-movements",
                rows.map((m) => ({
                  Date: m.moved_on,
                  Item: itemName(m.item_id),
                  Type: MOVEMENT_META[m.movement_type].label,
                  Quantity: m.quantity,
                  Rate: m.rate,
                  Value: m.quantity * m.rate,
                  Store: locName(m.location_id),
                  "To store": m.to_location_id ? locName(m.to_location_id) : "",
                  Project: projName(m.project_id),
                  Source: m.reference_type,
                  Note: m.note,
                })),
              )
            }
          >
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-white shadow-glow" disabled={!canManage}>
            <Plus className="w-4 h-4" /> New movement
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No stock movements yet.</div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b border-glass-border">
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Item</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Store</div>
            <div className="col-span-2 text-right">Qty / Value</div>
            <div className="col-span-1" />
          </div>
          {rows.map((m) => (
            <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3 border-b border-glass-border last:border-0 items-center">
              <div className="md:col-span-2 text-sm text-muted-foreground">{formatDate(m.moved_on)}</div>
              <div className="md:col-span-3 min-w-0">
                <p className="text-sm font-medium truncate">{itemName(m.item_id)}</p>
                {(m.note || projName(m.project_id)) && (
                  <p className="text-xs text-muted-foreground truncate">{[projName(m.project_id), m.note].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border", MOVEMENT_META[m.movement_type].cls)}>
                  {MOVEMENT_META[m.movement_type].label}
                </span>
              </div>
              <div className="md:col-span-2 text-sm truncate">
                {locName(m.location_id)}
                {m.to_location_id ? ` → ${locName(m.to_location_id)}` : ""}
              </div>
              <div className="md:col-span-2 md:text-right text-sm">
                <span className="font-semibold">{m.quantity}</span>
                <span className="text-muted-foreground"> · {formatINR(m.quantity * m.rate)}</span>
              </div>
              <div className="md:col-span-1 flex md:justify-end">
                {m.reference_type === "manual" && (
                  <Button variant="ghost" size="icon" aria-label="Delete movement" disabled={!canManage} onClick={() => handleDelete(m)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <StockMovementDialog open={open} onOpenChange={setOpen} onSubmit={addMovement} />
    </div>
  );
}
