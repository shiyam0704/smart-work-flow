import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";

export interface InventoryCategoryRow {
  id: string;
  company_id: string | null;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface InventoryCategoryInput {
  name: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

const CACHE_KEY = "stock_categories";
const EVENT_NAME = "stock-categories:changed";

async function fetchCategories(): Promise<InventoryCategoryRow[]> {
  const { data, error } = await supabase
    .from("stock_categories" as any)
    .select("*, stock_items(count)")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    // Fallback without join if foreign key not yet picked up by PostgREST cache
    const { data: fallback, error: fallbackError } = await supabase
      .from("stock_categories" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (fallbackError) {
      toast.error(`Failed to load categories: ${fallbackError.message}`);
      return [];
    }

    return (fallback ?? []).map((r: any) => ({
      ...r,
      description: r.description ?? "",
      is_active: r.is_active ?? true,
      sort_order: Number(r.sort_order ?? 0),
      item_count: 0,
    })) as InventoryCategoryRow[];
  }

  return (data ?? []).map((r: any) => {
    const rawCount = r.stock_items;
    const count = Array.isArray(rawCount) && rawCount[0] ? Number(rawCount[0].count ?? 0) : 0;
    return {
      ...r,
      description: r.description ?? "",
      is_active: r.is_active ?? true,
      sort_order: Number(r.sort_order ?? 0),
      item_count: count,
    };
  }) as InventoryCategoryRow[];
}

export function useInventoryCategories() {
  const { data, loading, reload } = useSharedResource<InventoryCategoryRow[]>(
    CACHE_KEY,
    fetchCategories,
    { eventName: EVENT_NAME }
  );

  const categories = data ?? [];

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active !== false),
    [categories]
  );

  const refresh = async () => {
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  const createCategory = async (
    input: InventoryCategoryInput
  ): Promise<InventoryCategoryRow | null> => {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      toast.error("Category name is required");
      return null;
    }

    // Client-side duplicate check within company
    const duplicate = categories.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.error(`Category "${trimmedName}" already exists`);
      return null;
    }

    const payload: any = {
      name: trimmedName,
      description: input.description?.trim() || "",
      is_active: input.is_active !== false,
      sort_order: input.sort_order ?? categories.length,
    };

    const { data: inserted, error } = await supabase
      .from("stock_categories" as any)
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505" || error.message.includes("unique")) {
        toast.error(`Category "${trimmedName}" already exists in this workspace`);
      } else {
        toast.error(error.message);
      }
      return null;
    }

    await refresh();
    toast.success(`Category "${trimmedName}" created`);
    return inserted as unknown as InventoryCategoryRow;
  };

  const updateCategory = async (
    id: string,
    patch: Partial<InventoryCategoryInput>
  ): Promise<boolean> => {
    if (patch.name !== undefined) {
      const trimmedName = patch.name.trim();
      if (!trimmedName) {
        toast.error("Category name cannot be empty");
        return false;
      }
      const duplicate = categories.some(
        (c) => c.id !== id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        toast.error(`Category "${trimmedName}" already exists`);
        return false;
      }
      patch.name = trimmedName;
    }

    const { error } = await supabase
      .from("stock_categories" as any)
      .update(patch as any)
      .eq("id", id);

    if (error) {
      if (error.code === "23505" || error.message.includes("unique")) {
        toast.error("A category with this name already exists in this workspace");
      } else {
        toast.error(error.message);
      }
      return false;
    }

    await refresh();
    toast.success("Category updated");
    return true;
  };

  const toggleActive = async (id: string, is_active: boolean): Promise<boolean> => {
    return updateCategory(id, { is_active });
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    const target = categories.find((c) => c.id === id);

    // Check item dependencies via category_id and legacy category name
    const [{ count: idCount }, { count: nameCount }] = await Promise.all([
      supabase
        .from("stock_items" as any)
        .select("id", { count: "exact", head: true })
        .eq("category_id", id),
      target
        ? supabase
            .from("stock_items" as any)
            .select("id", { count: "exact", head: true })
            .eq("category", target.name)
        : Promise.resolve({ count: 0 }),
    ]);

    const totalUsed = Math.max(idCount ?? 0, nameCount ?? 0);
    if (totalUsed > 0) {
      toast.error(
        `Cannot delete "${target?.name ?? "category"}": assigned to ${totalUsed} item(s). Reassign them or deactivate the category instead.`
      );
      return false;
    }

    const { error } = await supabase
      .from("stock_categories" as any)
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return false;
    }

    await refresh();
    toast.success("Category deleted");
    return true;
  };

  return {
    categories,
    activeCategories,
    loading,
    createCategory,
    updateCategory,
    toggleActive,
    deleteCategory,
    reload: refresh,
  };
}

// Backward compatibility alias
export const useStockCategories = () => {
  const { categories, loading, createCategory, updateCategory, deleteCategory, reload } =
    useInventoryCategories();

  return {
    rows: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      is_active: c.is_active,
      sort_order: c.sort_order,
      item_count: c.item_count,
    })),
    loading,
    add: async (name: string) => {
      const created = await createCategory({ name });
      return !!created;
    },
    update: async (id: string, patch: Partial<InventoryCategoryInput>) => {
      return updateCategory(id, patch);
    },
    remove: deleteCategory,
    reload,
  };
};
