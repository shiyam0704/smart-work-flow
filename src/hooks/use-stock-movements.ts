import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { useStockItems, type StockItemRow } from "@/hooks/use-stock-items";

export type MovementType = "in" | "out" | "transfer" | "adjust";

export const MOVEMENT_META: Record<MovementType, { label: string; cls: string }> = {
  in: { label: "In", cls: "bg-success/20 text-success border-success/30" },
  out: { label: "Out", cls: "bg-destructive/20 text-destructive border-destructive/30" },
  transfer: { label: "Transfer", cls: "bg-info/20 text-info border-info/30" },
  adjust: { label: "Adjust", cls: "bg-warning/20 text-warning border-warning/30" },
};

export interface StockMovementRow {
  id: string;
  item_id: string;
  location_id: string | null;
  to_location_id: string | null;
  movement_type: MovementType;
  quantity: number;
  rate: number;
  reference_type: string;
  reference_id: string | null;
  project_id: string | null;
  task_id: string | null;
  note: string;
  moved_on: string;
  created_at: string;
}

export interface StockMovementInput {
  item_id: string;
  location_id: string | null;
  to_location_id?: string | null;
  movement_type: MovementType;
  quantity: number;
  rate: number;
  project_id?: string | null;
  task_id?: string | null;
  note: string;
  moved_on: string;
}

const KEY = "stock_movements";
const EVENT = "stock-movements:changed";

async function fetchMovements(): Promise<StockMovementRow[]> {
  const { data, error } = await supabase
    .from("stock_movements" as any)
    .select("*")
    .order("moved_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    toast.error(`Failed to load stock movements: ${error.message}`);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    quantity: Number(r.quantity ?? 0),
    rate: Number(r.rate ?? 0),
  })) as StockMovementRow[];
}

export interface StockBalanceRow {
  item: StockItemRow;
  locationId: string | null;
  quantity: number;
  value: number;
  low: boolean;
}

export function useStockMovements() {
  const { data, loading, reload } = useSharedResource<StockMovementRow[]>(KEY, fetchMovements, {
    eventName: EVENT,
  });
  const { items } = useStockItems();
  const movements = data ?? [];

  const refresh = async () => {
    invalidateCache(KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const addMovement = async (input: StockMovementInput) => {
    if (!input.item_id) {
      toast.error("Pick an item");
      return false;
    }
    if (input.movement_type === "adjust") {
      if (input.quantity === 0 || isNaN(input.quantity)) {
        toast.error("Adjustment quantity cannot be zero");
        return false;
      }
    } else if (input.quantity <= 0 || isNaN(input.quantity)) {
      toast.error("Quantity must be greater than zero");
      return false;
    }

    // Check available balance for out and transfer
    if (input.movement_type === "out" || input.movement_type === "transfer") {
      const match = balances.find((b) => b.item.id === input.item_id && b.locationId === (input.location_id ?? null));
      const currentAvailable = match ? match.quantity : 0;
      if (currentAvailable < input.quantity) {
        toast.error(`Insufficient stock: only ${currentAvailable} available at this location (requested ${input.quantity})`);
        return false;
      }
    }

    const { data: auth } = await supabase.auth.getUser();
    const payload: any = {
      ...input,
      reference_type: "manual",
      created_by: auth.user?.id ?? null,
    };
    const { error } = await supabase.from("stock_movements" as any).insert(payload);
    if (error) { toast.error(error.message); return false; }
    toast.success("Stock movement recorded");
    await refresh();
    return true;
  };

  const deleteMovement = async (id: string) => {
    const { error } = await supabase.from("stock_movements" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Movement removed");
    await refresh();
    return true;
  };

  /** Signed effect of one movement on a given location. */
  const effect = (m: StockMovementRow, locationId: string | null): number => {
    if (m.movement_type === "in") return m.location_id === locationId ? m.quantity : 0;
    if (m.movement_type === "out") return m.location_id === locationId ? -m.quantity : 0;
    if (m.movement_type === "adjust") return m.location_id === locationId ? m.quantity : 0;
    // transfer
    if (m.location_id === locationId) return -m.quantity;
    if (m.to_location_id === locationId) return m.quantity;
    return 0;
  };

  /** Balance per item per location, derived from movement history only. */
  const balances: StockBalanceRow[] = useMemo(() => {
    const itemMap = new Map<string, StockItemRow>(items.map((i) => [i.id, i]));
    const map = new Map<string, { itemId: string; locationId: string | null; qty: number; value: number }>();
    for (const m of movements) {
      const locs = new Set<string | null>([m.location_id, m.to_location_id].filter((v) => v !== undefined));
      const it = itemMap.get(m.item_id);
      const effectiveRate = m.rate || it?.purchase_rate || 0;
      for (const loc of locs) {
        const delta = effect(m, loc ?? null);
        if (!delta) continue;
        const key = `${m.item_id}|${loc ?? "none"}`;
        const cur = map.get(key) ?? { itemId: m.item_id, locationId: loc ?? null, qty: 0, value: 0 };
        cur.qty += delta;
        cur.value += delta * effectiveRate;
        map.set(key, cur);
      }
    }
    const rows: StockBalanceRow[] = [];
    for (const v of map.values()) {
      const item = itemMap.get(v.itemId);
      if (!item) continue;
      const safeQty = Math.round(v.qty * 1000) / 1000;
      const safeVal = Math.round(Math.max(0, v.value || safeQty * item.purchase_rate) * 100) / 100;
      rows.push({
        item,
        locationId: v.locationId,
        quantity: safeQty,
        value: safeVal,
        low: safeQty < item.min_stock,
      });
    }
    return rows.sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [movements, items]);

  const totalsByItem = useMemo(() => {
    const map = new Map<string, { item: StockItemRow; quantity: number; value: number; low: boolean }>();
    for (const b of balances) {
      const cur = map.get(b.item.id) ?? { item: b.item, quantity: 0, value: 0, low: false };
      cur.quantity += b.quantity;
      cur.value += b.value;
      map.set(b.item.id, cur);
    }
    for (const v of map.values()) v.low = v.quantity < v.item.min_stock;
    return Array.from(map.values()).sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [balances]);

  const stockValue = useMemo(() => totalsByItem.reduce((s, r) => s + r.value, 0), [totalsByItem]);
  const lowStockCount = useMemo(() => totalsByItem.filter((r) => r.low).length, [totalsByItem]);

  return {
    movements,
    loading,
    addMovement,
    deleteMovement,
    balances,
    totalsByItem,
    stockValue,
    lowStockCount,
    reload: refresh,
    refresh,
  };
}
