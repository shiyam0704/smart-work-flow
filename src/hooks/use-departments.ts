import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, mutateCache, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";

const DEPT_EVENT = "departments:changed";
const emitChange = () => window.dispatchEvent(new Event(DEPT_EVENT));

export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
}

export type DepartmentInput = {
  name: string;
  code: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
};

const CACHE_KEY = "departments";

async function fetchDepartments(): Promise<DepartmentRow[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("sort_order");
  if (error) {
    toast.error(`Failed to load departments: ${error.message}`);
    return [];
  }
  return (data ?? []) as DepartmentRow[];
}

export function useDepartments() {
  const { data, loading, reload } = useSharedResource<DepartmentRow[]>(
    CACHE_KEY,
    fetchDepartments,
    { eventName: DEPT_EVENT },
  );
  const departments = data ?? [];

  useEffect(() => {
    return subscribeTables("departments", ["departments"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const addDepartment = async (input: DepartmentInput) => {
    const nextOrder = (departments[departments.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("departments").insert({
      name: input.name,
      code: input.code,
      color: input.color ?? "var(--neon-cyan)",
      icon: input.icon ?? "Briefcase",
      is_active: input.is_active ?? true,
      sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    toast.success("Department added");
    emitChange();
  };

  const updateDepartment = async (id: string, patch: Partial<DepartmentInput>) => {
    const { error } = await supabase.from("departments").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    mutateCache<DepartmentRow[]>(CACHE_KEY, (list) =>
      list.map((d) => (d.id === id ? { ...d, ...patch } as DepartmentRow : d)),
    );
    toast.success("Department updated");
    emitChange();
  };

  const deleteDepartment = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    mutateCache<DepartmentRow[]>(CACHE_KEY, (list) => list.filter((d) => d.id !== id));
    toast.success("Department deleted");
    emitChange();
  };

  const move = async (id: string, dir: "up" | "down") => {
    const idx = departments.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= departments.length) return;
    const a = departments[idx];
    const b = departments[swapIdx];
    const { error: e1 } = await supabase.from("departments").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: e2 } = await supabase.from("departments").update({ sort_order: a.sort_order }).eq("id", b.id);
    if (e1 || e2) return toast.error((e1 ?? e2)!.message);
    emitChange();
  };

  return { departments, loading, reload, addDepartment, updateDepartment, deleteDepartment, move };
}
