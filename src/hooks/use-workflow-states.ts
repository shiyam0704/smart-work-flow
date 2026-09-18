import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";

export interface WorkflowStateRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_completed?: boolean;
}

const EVENT = "workflow-states:changed";
const CACHE_KEY = "workflow_states";

async function fetchStates(): Promise<WorkflowStateRow[]> {
  const { data, error } = await supabase
    .from("workflow_states")
    .select("*")
    .order("sort_order");
  if (error) {
    toast.error(`Failed to load workflow states: ${error.message}`);
    return [];
  }
  if (!data || data.length === 0) {
    const defaults = [
      { name: "To Do", color: "var(--neon-cyan)", sort_order: 0, is_completed: false },
      { name: "In Progress", color: "var(--neon-purple)", sort_order: 1, is_completed: false },
      { name: "Completed", color: "var(--neon-green)", sort_order: 2, is_completed: true },
    ];
    const { data: inserted, error: insErr } = await (supabase.from("workflow_states" as any) as any)
      .insert(defaults)
      .select();
    if (!insErr && inserted && inserted.length > 0) {
      return inserted as WorkflowStateRow[];
    }
  }
  return (data ?? []) as WorkflowStateRow[];
}

export function useWorkflowStates() {
  const { data, loading, reload } = useSharedResource<WorkflowStateRow[]>(
    CACHE_KEY,
    fetchStates,
    { eventName: EVENT },
  );
  const states = data ?? [];

  const emitChange = async () => {
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  useEffect(() => {
    return subscribeTables("workflow_states", ["workflow_states"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const addState = async (input: { name: string; color: string; is_completed?: boolean }) => {
    const sort_order = states.length ? Math.max(...states.map((s) => s.sort_order)) + 1 : 0;
    const { error } = await (supabase.from("workflow_states" as any) as any).insert({ ...input, sort_order });
    if (error) return toast.error(error.message);
    toast.success("Workflow state added");
    await emitChange();
  };

  const updateState = async (
    id: string,
    patch: Partial<Pick<WorkflowStateRow, "name" | "color" | "is_completed">>,
  ) => {
    const { error } = await (supabase.from("workflow_states" as any) as any).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    await emitChange();
  };

  const deleteState = async (id: string) => {
    // Check for dependent tasks before deleting (BUG #30)
    const { count, error: countErr } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status_id", id);
    if (countErr) {
      toast.error(countErr.message);
      return;
    }
    if (count && count > 0) {
      toast.error(`Cannot delete state because ${count} task${count > 1 ? "s" : ""} currently use it. Reassign them first.`);
      return;
    }
    const { error } = await supabase.from("workflow_states").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    await emitChange();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const sorted = [...states].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    const a = sorted[idx];
    await Promise.all([
      supabase.from("workflow_states").update({ sort_order: swap.sort_order }).eq("id", a.id),
      supabase.from("workflow_states").update({ sort_order: a.sort_order }).eq("id", swap.id),
    ]);
    emitChange();
  };

  return { states, loading, reload, addState, updateState, deleteState, move };
}
