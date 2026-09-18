import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClientGroupRow {
  id: string;
  name: string;
  sort_order: number;
}

const EVENT = "client-groups:changed";
const emitChange = () => window.dispatchEvent(new Event(EVENT));

export function useClientGroups() {
  const [groups, setGroups] = useState<ClientGroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_groups")
      .select("*")
      .order("sort_order");
    if (error) toast.error(`Failed to load client groups: ${error.message}`);
    setGroups((data ?? []) as ClientGroupRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener(EVENT, handler);
    const channel = supabase
      .channel(`client-groups-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_groups" }, () => load())
      .subscribe();
    return () => {
      window.removeEventListener(EVENT, handler);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const addGroup = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const nextOrder = (groups[groups.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase
      .from("client_groups")
      .insert({ name: trimmed, sort_order: nextOrder });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Group added");
    emitChange();
    return true;
  };

  const renameGroup = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const current = groups.find((g) => g.id === id);
    if (!current) return false;
    const { error } = await supabase
      .from("client_groups")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    // Cascade rename on clients table so existing clients keep their group label
    if (current.name !== trimmed) {
      await supabase
        .from("clients")
        .update({ client_group: trimmed })
        .eq("client_group", current.name);
    }
    toast.success("Group renamed");
    emitChange();
    window.dispatchEvent(new Event("clients:changed"));
    return true;
  };

  const deleteGroup = async (id: string) => {
    const { error } = await supabase.from("client_groups").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Group deleted");
    emitChange();
    return true;
  };

  const move = useCallback(
    async (id: string, dir: "up" | "down") => {
      const idx = groups.findIndex((g) => g.id === id);
      if (idx < 0) return;
      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= groups.length) return;
      const a = groups[idx];
      const b = groups[swapWith];
      await supabase
        .from("client_groups")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id);
      await supabase
        .from("client_groups")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id);
      emitChange();
    },
    [groups]
  );

  return { groups, loading, addGroup, renameGroup, deleteGroup, move, reload: load };
}
