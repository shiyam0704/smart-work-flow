import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStockMovements } from "@/hooks/use-stock-movements";
import { useStockLocations } from "@/hooks/use-stock-settings";
import { formatINR } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";

export const Route = createFileRoute("/c/$slug/_app/stock/balance")({
  component: StockBalancePage,
});

const ALL = "all";

function StockBalancePage() {
  const { balances, totalsByItem, stockValue, lowStockCount, loading } = useStockMovements();
  const { rows: locations } = useStockLocations();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<string>(ALL);
  const [onlyLow, setOnlyLow] = useState(false);

  const locationName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "Unassigned";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source =
      location === ALL
        ? totalsByItem.map((t) => ({ item: t.item, locationId: null as string | null, quantity: t.quantity, value: t.value, low: t.low }))
        : balances.filter((b) => b.locationId === location);
    return source.filter((r) => {
      if (onlyLow && !r.low) return false;
      if (!q) return true;
      return [r.item.name, r.item.code, r.item.category].join(" ").toLowerCase().includes(q);
    });
  }, [balances, totalsByItem, query, location, onlyLow]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock value</p>
          <p className="font-display font-bold text-lg mt-1">{formatINR(stockValue)}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Items tracked</p>
          <p className="font-display font-bold text-lg mt-1">{totalsByItem.length}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Below minimum</p>
          <p className="font-display font-bold text-lg mt-1 text-warning">{lowStockCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative sm:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 bg-input border-border" />
        </div>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="sm:w-48 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stores</SelectItem>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={onlyLow ? "default" : "outline"} onClick={() => setOnlyLow((v) => !v)} className={onlyLow ? "bg-gradient-primary text-white" : ""}>
          <AlertTriangle className="w-4 h-4" /> Low stock
        </Button>
        <Button
          variant="outline"
          className="sm:ml-auto"
          onClick={() =>
            exportRowsAsCsv(
              "stock-balance",
              rows.map((r) => ({
                Item: r.item.name,
                Code: r.item.code,
                Category: r.item.category,
                Store: location === ALL ? "All stores" : locationName(r.locationId),
                Quantity: r.quantity,
                Unit: r.item.unit,
                Value: r.value,
                "Below minimum": r.low ? "Yes" : "No",
              })),
            )
          }
        >
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No stock yet. Receive goods against a purchase order or record a movement.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b border-glass-border">
            <div className="col-span-5">Item</div>
            <div className="col-span-2">Store</div>
            <div className="col-span-2 text-right">Quantity</div>
            <div className="col-span-3 text-right">Value</div>
          </div>
          {rows.map((r) => (
            <div key={`${r.item.id}-${r.locationId ?? "all"}`} className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-3 px-4 py-3 border-b border-glass-border last:border-0 items-center">
              <div className="md:col-span-5 min-w-0">
                <p className="font-medium truncate flex items-center gap-2">
                  {r.item.name}
                  {r.low && <AlertTriangle className="w-3.5 h-3.5 text-warning" aria-label="Below minimum" />}
                </p>
                <p className="text-xs text-muted-foreground truncate">{r.item.category || "No category"}</p>
              </div>
              <div className="md:col-span-2 text-sm">{location === ALL ? "All stores" : locationName(r.locationId)}</div>
              <div className="md:col-span-2 md:text-right text-sm">{r.quantity} {r.item.unit}</div>
              <div className="md:col-span-3 md:text-right font-semibold text-sm">{formatINR(r.value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
