import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";

export interface StockSettingsRow {
  id: string;
  company_id: string | null;
  default_gst_percent: number;
  default_po_terms: string;
  paper_size: "A4" | "A5";
  print_template: "classic" | "modern" | "compact";
  require_approval: boolean;
}

export interface NamedListRow {
  id: string;
  name: string;
  sort_order: number;
  is_active?: boolean;
}

const S_KEY = "stock_settings";
const S_EVENT = "stock-settings:changed";

export const DEFAULT_UNITS = ["Nos", "Kg", "Litre", "Box", "Metre", "Set"];

async function fetchSettings(): Promise<StockSettingsRow | null> {
  const { data } = await supabase.from("stock_settings" as any).select("*").limit(1).maybeSingle();
  if (!data) return null;
  const r = data as any;
  return { ...r, default_gst_percent: Number(r.default_gst_percent) } as StockSettingsRow;
}

export function useStockSettings() {
  const { data, loading, reload } = useSharedResource<StockSettingsRow | null>(S_KEY, fetchSettings, {
    eventName: S_EVENT,
  });

  const save = async (patch: Partial<StockSettingsRow>) => {
    if (data?.id) {
      const { error } = await supabase.from("stock_settings" as any).update(patch as any).eq("id", data.id);
      if (error) { toast.error(error.message); return false; }
    } else {
      const { error } = await supabase.from("stock_settings" as any).insert(patch as any);
      if (error) { toast.error(error.message); return false; }
    }
    invalidateCache(S_KEY);
    await reload();
    window.dispatchEvent(new Event(S_EVENT));
    toast.success("Stock & purchase settings saved");
    return true;
  };

  return { settings: data ?? null, loading, save, reload };
}

/** Generic company-scoped named list (stores / units / item categories). */
function useNamedList(table: string, key: string, withActive = false) {
  const event = `${key}:changed`;
  const { data, loading, reload } = useSharedResource<NamedListRow[]>(
    key,
    async () => {
      const { data, error } = await supabase.from(table as any).select("*").order("sort_order");
      if (error) return [];
      return (data ?? []) as unknown as NamedListRow[];
    },
    { eventName: event },
  );
  const rows = data ?? [];

  const refresh = async () => {
    invalidateCache(key);
    await reload();
    window.dispatchEvent(new Event(event));
  };

  const add = async (name: string) => {
    const payload: any = { name, sort_order: rows.length };
    if (withActive) payload.is_active = true;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const update = async (id: string, patch: Partial<NamedListRow>) => {
    const { error } = await supabase.from(table as any).update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  return { rows, loading, add, update, remove, reload: refresh };
}

export const useStockLocations = () => useNamedList("stock_locations", "stock_locations", true);
export const useStockUnits = () => useNamedList("stock_units", "stock_units");
export { useStockCategories, useInventoryCategories } from "./use-inventory-categories";
