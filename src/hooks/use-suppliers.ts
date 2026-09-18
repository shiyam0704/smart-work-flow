import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";

export interface SupplierRow {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  gstin: string;
  opening_balance: number;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface SupplierInput {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  gstin: string;
  opening_balance: number;
  notes: string;
  is_active: boolean;
}

const KEY = "suppliers";
const EVENT = "suppliers:changed";

async function fetchSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabase.from("suppliers" as any).select("*").order("name");
  if (error) {
    toast.error(`Failed to load suppliers: ${error.message}`);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    opening_balance: Number(r.opening_balance ?? 0),
  })) as SupplierRow[];
}

export function useSuppliers() {
  const { data, loading, reload } = useSharedResource<SupplierRow[]>(KEY, fetchSuppliers, {
    eventName: EVENT,
  });

  const refresh = async () => {
    invalidateCache(KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const addSupplier = async (input: SupplierInput) => {
    const { data: row, error } = await supabase.from("suppliers" as any).insert(input as any).select("id").single();
    if (error) { toast.error(error.message); return null; }
    toast.success("Supplier added");
    await refresh();
    return (row as any)?.id as string;
  };

  const updateSupplier = async (id: string, patch: Partial<SupplierInput>) => {
    const { error } = await supabase.from("suppliers" as any).update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Supplier updated");
    await refresh();
    return true;
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from("suppliers" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Supplier deleted");
    await refresh();
    return true;
  };

  return { suppliers: data ?? [], loading, addSupplier, updateSupplier, deleteSupplier, reload: refresh };
}
