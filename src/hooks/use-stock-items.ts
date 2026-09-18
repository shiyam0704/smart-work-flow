import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";

export interface StockItemRow {
  id: string;
  name: string;
  code: string;
  category_id: string | null;
  category: string;
  unit: string;
  purchase_rate: number;
  selling_rate: number;
  min_stock: number;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export type StockItemInput = Omit<StockItemRow, "id" | "created_at">;

const KEY = "stock_items";
const EVENT = "stock-items:changed";

async function fetchItems(): Promise<StockItemRow[]> {
  const { data, error } = await supabase
    .from("stock_items" as any)
    .select("*, stock_categories(id, name)")
    .order("name");

  if (error) {
    // Fallback if PostgREST cache has not reloaded foreign key join yet
    const { data: fallback, error: fallbackErr } = await supabase
      .from("stock_items" as any)
      .select("*")
      .order("name");

    if (fallbackErr) {
      toast.error(`Failed to load items: ${fallbackErr.message}`);
      return [];
    }

    return ((fallback ?? []) as any[]).map((r) => ({
      ...r,
      category_id: r.category_id ?? null,
      category: r.category ?? "",
      purchase_rate: Number(r.purchase_rate ?? 0),
      selling_rate: Number(r.selling_rate ?? 0),
      min_stock: Number(r.min_stock ?? 0),
    })) as StockItemRow[];
  }

  return ((data ?? []) as any[]).map((r) => {
    const categoryName = r.stock_categories?.name || r.category || "";
    return {
      ...r,
      category_id: r.category_id ?? null,
      category: categoryName,
      purchase_rate: Number(r.purchase_rate ?? 0),
      selling_rate: Number(r.selling_rate ?? 0),
      min_stock: Number(r.min_stock ?? 0),
    };
  }) as StockItemRow[];
}

export function useStockItems() {
  const { data, loading, reload } = useSharedResource<StockItemRow[]>(KEY, fetchItems, {
    eventName: EVENT,
  });

  const refresh = async () => {
    invalidateCache(KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const addItem = async (input: StockItemInput) => {
    const payload: any = {
      ...input,
      category_id: input.category_id || null,
      category: input.category || "",
    };

    const { error } = await supabase.from("stock_items" as any).insert(payload);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Item added");
    await refresh();
    return true;
  };

  const updateItem = async (id: string, patch: Partial<StockItemInput>) => {
    const payload: any = { ...patch };
    if ("category_id" in patch) {
      payload.category_id = patch.category_id || null;
    }

    const { error } = await supabase.from("stock_items" as any).update(payload).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Item updated");
    await refresh();
    return true;
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("stock_items" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Item deleted");
    await refresh();
    return true;
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("stock_items" as any).update({ is_active }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(is_active ? "Item activated" : "Item deactivated");
    await refresh();
    return true;
  };

  return { items: data ?? [], loading, addItem, updateItem, deleteItem, toggleActive, reload: refresh };
}
